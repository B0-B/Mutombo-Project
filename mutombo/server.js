/** Mutombo - Main Server Code **/

const fs        = require('fs/promises'); // Use promise-based API
const path      = require('path');
const multer    = require('multer');
const http      = require('http');
const express   = require('express');
const { loadJSON, 
        saveJSON, 
        saveConfig, 
        _hash, 
        log, 
        configUpdater, 
        analyzeStats,
        loadConfig,
        stripURLtoDomain,
        collectRequestInfoForStats,
        sessionWatchdog,
        noteActivity} = require('#utils');
const { RDNS }      = require('#rdns');
const { Blocker }   = require('#block');

// Paths
const staticPath    = path.join(__dirname, 'public/static');
const logPath       = path.join(__dirname, 'logs');


(async () => {
    
    // ---- Globals ----
    var config          = await loadConfig(); // load the config file
    var upload          = multer({ dest: 'data/img/' }); // image access
    const urlPattern    = /^[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]*$/;

    // Authentication
    config.authenticated        = false;
    await saveConfig(config);
    // var lastActivity         = 0;

    // Caching Globals
    // Statistics Aggregation
    var stats = {
        dns: {
            top_queried_domains: [],
            top_blocked_domains: [],
            top_clients: {},
            resolutions: {
                total_events: 0,
                by_domain: {}, // separated count by domain
                timeseries: {} // unified from all domains
            },
            blocks: {
                total_events: 0,
                by_domain: {},
                timeseries: {}
            }
        }
    }

    // ---- Load Modules ----
    // Load RDNS Service
    var rdns        = new RDNS( logPath );
    // Load Blocker Service
    var blocker     = new Blocker( config );
    await blocker.loadAndCacheServices();
    await blocker.loadBlockBrowseList();
    // await blocker.downloadServiceFavicons(2000); // Downloads all service favicons before the corr. domains get blocked.
    await blocker.cacheFromConfig(); // Initialize all blocklists from config

    // ---- Additional Loops ----
    // Run a dynamic config updater
    // Safe background loop to reload config, rectify if errors occur etc.
    const configReloadTimeMs = 100;
    configUpdater(config, configReloadTimeMs);
    // Run stats analysis repeatedly
    const statsAnalysisTimeMs = 5000;
    analyzeStats(stats, statsAnalysisTimeMs);
    // Run session watchdog to terminate session after idle timeout
    const sessionWatchdogTimeMs = 100;
    sessionWatchdog(config, sessionWatchdogTimeMs);

    // ---- Web Server & API endpoints ----
    const app = express();

    // Serve static files from the "public" directory
    app.use(express.static(staticPath));

    // root endpoint
    app.get('/', (req, res, next) => {
        noteActivity();
        // Pass control again to express static middleware
        next();
    });

    // Authentication endpoint
    app.use(express.json()); // auto json parsing etc.
    app.post('/auth', async (req, res) => {

        // Check if credentials are set for signup
        if (req.body.signup) {
            if (config.authHash == "")
                return res.json({status: false});
            else
                return res.json({status: true});
        }
            

        // Check if session is still authenticated
        if (req.body.check) {
            // Source config (just in case)
            config          = await loadConfig();
            if (config.authenticated == true) {
                return res.json({status: true});
            } else {
                return res.json({status: false});
            }
        }
            

        // extract the payload
        const payload = req.body.password;
        
        // type correction
        if (typeof payload !== 'string')
            return res.status(400).json({ msg: '[ERROR] Invalid input', status: false });
        
        // hash the payload
        const hash = _hash(payload);

        // Check if a hash was set for this dashboard yet.
        if (!config.authHash) {
            config.authHash = hash;
            config.authenticated = true;
            noteActivity(config);
            saveConfig(config);
            return res.json({msg: 'New password was set!', status: true});
        }

        // Otherwise check if the hashes match
        if (config.authHash == hash) {
            config.authenticated = true;
            noteActivity(config);
            saveConfig(config);
            console.log('New login!')
            return res.json({msg: 'Authenticated.', status: true});
        }

        // Block everything else
        config.authenticated = false;
        return res.json({msg: '[ERROR] Blocked.', status: false});

    });

    // State change endpoint.
    app.use(express.json());
    app.post('/state', async (req, res) => {

        // Login wall. 
        if (!config.authenticated) return res.json({msg: '[ERROR] Permission denied: No authentication'})
        console.log('Received request body:\n', req.body)

        // Serve the most recent state of the config object
        if (req.body.mode === 'get') {
            // Source the config
            config = await loadConfig();
            // Respond with state data
            return res.json({data: config.state})
        }
        // Complete override option
        else if (req.body.mode === 'override') {
            config.state = req.body.data;
            noteActivity();
            await saveConfig(); // Save the config persistently.
            return res.json({status: true})
        }
        // Container override option
        else if (req.body.mode === 'container') {
            const container_info = req.body.data;
            console.log('data received', container_info)
            config.state.dashboard.containers[container_info.name] = container_info;
            noteActivity();
            await saveConfig(config); // Save the config persistently.
            return res.json({status: true})
        }
        // Blocklist activity setting
        else if (req.body.mode === 'blocklist') {

            // Note activity ahead.
            noteActivity(config);

            // Check if activity is defined as a boolean
            if (req.body.type === 'activity') {
                
                // Short sanity check
                if (!req.body.name) return res.status(403).send(`[ERROR] No 'name' parameter provided to specify the container!`);
                if (!(typeof req.body.value === 'boolean')) return res.status(403).send(`[ERROR] No 'value' parameter provided to specify the container!`);
                
                const blockListName = req.body.name;

                // Source the blocklist in config array and set activity
                for (let blocklist of config.blocking.blocklists) {
                    // console.log('TEST', blocklist.active, req.body.activity, blocklist.name, blockListName)
                    if (blocklist.name === blockListName){ //&& typeof req.body.activity === 'boolean') {
                        blocklist.active = req.body.value;
                        break
                    }
                }

                // Save config & forward the config via shortcut to blocker service
                saveConfig(config);
                blocker.config = config;
                
                return res.json({msg: `Successfully switched "${blockListName}" activity.`})
            }
            // Remove blocklist with provided name
            else if (req.body.type === 'remove') {

                // Short sanity check
                if (!req.body.name) return res.status(403).send(`[ERROR] No 'name' parameter provided to specify the container!`);
                const blockListName = req.body.name;

                // Remove the blocklist from config array
                const index = config.blocking.blocklists.findIndex(obj => obj.name === req.body.name);
                if (index !== -1) config.blocking.blocklists.splice(index, 1); // removes the object with id === 42

                // Save config & forward the config via shortcut to blocker service
                saveConfig(config);
                blocker.config = config;
                
                return res.json({msg: `Successfully removed "${blockListName}" from blocklists.`})

            }
            // Adds new blocklist received from client
            else if (req.body.type === 'add') {

                try {
                    const url = req.body.url, label = req.body.label;
                    await blocker.addNewBlockList(url, label);
                    return res.json({msg: `Successfully added new blocklist!`})
                } catch (error) {
                    console.log('[/state.add][ERROR]', error);
                    // Ensure the error
                    return res.json({ err: error.message || 'An unexpected error occurred' });
                }
                
            } else {
                return res.status(400).send(`[ERROR] No valid parameters provided!`);
            }
        }
    });

    // Statistics dedicated end-point (pure get end-point)
    app.post('/stats', async (req, res) => {
        // Login wall. 
        if (!config.authenticated) return res.json({msg: '[ERROR] Permission denied: No authentication'})
        if (req.body.type === 'dns') {
            return res.json(stats.dns)
        }
    });

    // Config delivery endpoint.
    app.use(express.json());
    app.post('/conf', async (req, res) => {
        
        // Login wall. 
        if (!config.authenticated) return res.json({msg: '[ERROR] Permission denied: No authentication'})
        
        // Check if mode parameter was specified
        if (!req.body.mode)
            return res.json({msg: `/conf-endpoint: No "mode" parameter specified.`, data: {}});

        // Get mode for retrieving data from the config.
        const delimiter = '.';
        if (req.body.mode == 'get') {
            // Source config freshly
            config          = await loadConfig();
            const target = "conf." + req.body.key
            const keyChain      = req.body.key.split(delimiter);
            let currentValue    = config;
            for (let currentKey of keyChain) {
                currentValue = currentValue[currentKey]
            }
            const data = currentValue;
            console.log('/conf-endpoint - requested data target:', target);
            return res.json({msg: "Value to key: " + target, data: data})
        }

        // Set mode for injecting data into the config.
        else if (req.body.mode == 'set') {
            if (!req.body.data)
                return res.json({msg: `/conf-endpoint: "set"-mode requires "data" parameter which was not specified.`, data: {}});
            let current = config;
            const keyChain      = req.body.key.split(delimiter);
            // Work down the key chain
            for (let currentKey of keyChain.slice(0, -1)) {
                // Sanity check to ensure the current key always points to an object
                if (!(currentKey in current) || typeof current[currentKey] !== 'object')
                    return res.json({msg: `/conf-endpoint: Cannot resolve the keychain at key/level "${currentKey}"`, data: {}});
                current = current[currentKey];
            }
            current[keyChain[keyChain.length-1]] = req.body.data;
            saveConfig(config);
        }
        
    });

    // Endpoint for delivering blocklist browse list.
    app.use(express.json());
    app.post('/blockbrowse', async (req, res) => {
        
        // Login wall. 
        if (!config.authenticated) return res.json({msg: '[ERROR] Permission denied: No authentication'})
        
        // Check if mode parameter was specified
        return res.send(blocker.blockBrowseList)
        
    });

    // Logs endpoint.
    app.post('/logs', async (req, res) => {
        
        // Login wall. 
        if (!config.authenticated) return res.json({msg: '[ERROR] Permission denied: No authentication'})
        
        try {

            // Limit the output in any case
            const top_n = 100;

            // Load logs from log file
            const logFilePath  = path.join(logPath, 'rdns.log'); 
            let   logList      = (await fs.readFile(logFilePath, 'utf8')).split('\n').reverse();
            let   selectedLogs = [];

            // Check if a search string was provided
            if (req.body.searchInput) {
                // Curl through the logs using provided search input
                const searchStringLower = req.body.searchInput.toLowerCase();
                for (let i = 0; i < logList.length; i++) {
                    // Stop after top_n results were aggregated
                    if (selectedLogs.length >= top_n) break;
                    // Probe each line for a match
                    const logLine = logList[i];
                    if (logLine && logLine.toLowerCase().includes(searchStringLower)) {
                        // Split the log line into timestamp and log message
                        const time = logLine.split('\t')[0];
                        const log  = logLine.split('\t')[1];
                        // Append json-ized log
                        selectedLogs.push({time, log})
                    }
                }
            }

            // Otherwise proceed by returning the top n standard logs
            else {
                // Slice logList if it becomes too long
                if (logList.length > top_n) {
                    logList = logList.slice(0, top_n);
                }
                // Convert to json
                for (let logLine of logList) {
                    if (!logLine) continue; 
                    const time = logLine.split('\t')[0];
                    const log  = logLine.split('\t')[1];
                    selectedLogs.push({time, log})
                }
            }

            return res.send({logs: selectedLogs})

        } catch (error) {

            console.error('/logs -', error);
            return res.status(502).send({ error: "Cannot serve logs at the moment." });
        
        }

    });

    // Services Endpoint
    app.post('/services', async (req, res) => {
        // Login wall. 
        if (!config.authenticated) return res.json({msg: '[ERROR] Permission denied: No authentication'})
        // API mode selection
        console.log('services request:', req.body)
        if (req.body.mode === 'get') {
            return res.send(blocker.cache.services)
        } else if (req.body.mode === 'set') {
            // Override the blocked state in cached services
            blocker.cache.services[req.body.domain].blocked = req.body.state;
            // Dump the state in service file
            if (req.body.state) {
                blocker.blockService(req.body.domain, true);
            } else {
                blocker.unblockService(req.body.domain, true);
            }
            return res.send({status: true})
        }
    });

    // Download endpoint.
    app.use(express.json());
    app.get('/download/:filename', (req, res) => {
        // Login wall. 
        if (!config.authenticated) return res.json({msg: '[ERROR] Permission denied: No authentication'})
        
        // extract filename and file extension
        const filename = req.params.filename;
        const ext = path.extname(filename).toLowerCase();
        // Do file distinction
        // Start with image requests.
        if (ext === '.jpg' || ext === '.png' || ext === '.jpeg') {
            const imagePath = path.join(__dirname, 'data/img', req.params.filename);
            res.sendFile(imagePath, err => {
                if (err) {
                    console.error('Error sending file:', err);
                    res.status(404).send('Image not found');
                }
            });
        }
        
    });

    // Upload endpoint.
    app.post('/upload', upload.single('image'), (req, res) => {
        // Login wall. 
        if (!config.authenticated) return res.json({msg: '[ERROR] Permission denied: No authentication'})
        console.log('/upload - Image received:', req.file.originalname);
        res.json({ msg: 'Image uploaded successfully', status: true });
    });

    // Main RDNS & Blocking endpoint.
    /* Stick to JSON. It's not noticeably slower, and user-friendly. */
    app.get('/resolve', async (req, res) => {

        const url = req.query.url;
        console.log('[resolve] Requested domain: ', url)

        // Validate input format (protect against XSS)
        if (!(url && urlPattern.test(url))) 
            return res.status(400).send(`[ERROR] No valid URL format submitted!`);

        // Strip down the url to extract domain
        const domain = stripURLtoDomain(url);

        // Before resolving, check for forbidden domains via blocker.
        // What would the server expect as answer? 0.0.0.0? or just send "blocked"
        if (blocker.blocked(domain)) {
            collectRequestInfoForStats(domain, stats, 'blocks', req);
            return res.status(403).send({ error: "Domain is blocked." });
        }

        // Try to resolve the domain via RDNS,
        // in case the IP cannot be resolved the resolve method 
        // returns a null IP i.e. 0.0.0.0
        const ip = await rdns.resolve(domain);
        if (ip !== '0.0.0.0')
            collectRequestInfoForStats(domain, stats, 'resolutions', req);
        
        // Send the IP which at this point should be defined.
        return res.send(ip);

    });


    // Let the server listen on specified port
    const server = http.createServer(app);
    server.listen(3000, () => {
        console.log('🚀 HTTP server running at http://localhost:3000');
    });

})()