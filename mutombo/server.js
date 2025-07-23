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
        loadConfig,
        stripURLtoDomain} = require('#utils');
const { RDNS }      = require('#rdns');
const { Blocker }   = require('#block');

// Paths
const staticPath    = path.join(__dirname, 'public/static');
const logPath       = path.join(__dirname, 'logs');

(async () => {
    
    // Globals
    var config          = await loadConfig(); // load the config file
    var upload          = multer({ dest: 'data/img/' }); // image access
    const urlPattern    = /^[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]*$/;
    var authenticated   = false;

    // ---- Load Modules ----
    // Load RDNS Service
    var rdns        = new RDNS( logPath );
    // Load Blocker Service
    var blocker     = new Blocker( config );
    await blocker.cacheFromConfig() // Initialize all blocklists from config

    // ---- Additional Loops ----
    // Run a dynamic config updater
    // Safe background loop to reload config
    const configReloadTimeMs = 1000;
    // const configSaveCopy = config;
    configUpdater(config, configReloadTimeMs);


    // ---- Web Server & API endpoints ----
    const app = express();

    // Serve static files from the "public" directory
    app.use(express.static(staticPath));

    // Authentication endpoint
    app.use(express.json()); // auto json parsing etc.
    app.post('/auth', (req, res) => {

        // Check if credentials are set for signup
        if (req.body.signup)
            if (config.authHash == "")
                return res.json({status: false});
            else
                return res.json({status: true});

        // Check if session is still authenticated
        if (req.body.check)
            if (authenticated == true)
                return res.json({status: true});
            else
                return res.json({status: false});

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
            saveConfig(config);
            authenticated = true;
            return res.json({msg: 'New password was set!', status: true});
        }

        // Otherwise check if the hashes match
        if (config.authHash == hash) {
            authenticated = true;
            console.log('New login!')
            return res.json({msg: 'Authenticated.', status: true});
        }

        // Block everything else
        authenticated = false;
        return res.json({msg: '[ERROR] Blocked.', status: false});

    });

    // State change endpoint.
    app.use(express.json());
    app.post('/state', async (req, res) => {
        // Login wall. 
        if (!authenticated) return res.json({msg: '[ERROR] Permission denied: No authentication'})
        
        // Serve the most recent state.
        if (req.body.mode === 'get') {
            // Source the config
            config = await loadConfig();
            // Respond with state data
            return res.json({data: config.state})
        }
        // Complete override option
        else if (req.body.mode === 'override') {
            config.state = req.body.data;
            await saveConfig(); // Save the config persistently.
            return res.json({status: true})
        }
        // Container override option
        else if (req.body.mode === 'container') {
            const container_info = req.body.data;
            config.state.dashboard.containers[container_info.name] = container_info;
            await saveConfig(config); // Save the config persistently.
            return res.json({status: true})
        }
        // Blocklist activity setting
        else if (req.body.mode === 'blocklist') {
            
            // Short sanity check
            if (!req.body.name) {
                return res.status(403).send(`[ERROR] No 'name' parameter provided to specify the container!`)
            }

            const blockListName = req.body.name;

            // Check if activity is defined as a boolean
            if (typeof req.body.activity === 'boolean') {

                // Source the blocklist in config array and set activity
                for (let blocklist of config.blocking.blocklists) {
                    if (blocklist.name === blockListName) {
                        blocklist.active = req.body.activity;
                        break
                    }
                }

                // Save config & forward the config via shortcut to blocker service
                saveConfig(config);
                blocker.config = config;
                
                return res.json({msg: `Successfully switched "${blockListName}" activity.`})
            }

            // Remove blocklist with provided name
            else if (typeof req.body.remove === 'boolean') {

                // Remove the blocklist from config array
                const index = config.blocking.blocklists.findIndex(obj => obj.name === req.body.name);
                if (index !== -1) config.blocking.blocklists.splice(index, 1); // removes the object with id === 42

                // Save config & forward the config via shortcut to blocker service
                saveConfig(config);
                blocker.config = config;
                
                return res.json({msg: `Successfully removed "${blockListName}" from blocklists.`})

            }
        }
    });

    // Config delivery endpoint.
    app.use(express.json());
    app.post('/conf', async (req, res) => {
        // Login wall. 
        if (!authenticated) return res.json({msg: '[ERROR] Permission denied: No authentication'})
        
        const delimiter = '.';
        if (!req.body.mode)
            return res.json({msg: `/conf-endpoint: No "mode" parameter specified.`, data: {}});
        // Get mode for retrieving data from the config.
        if (req.body.mode == 'get') {
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
        else if (mode == 'set') {
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

    // Download endpoint.
    app.use(express.json());
    app.get('/download/:filename', (req, res) => {
        // Login wall. 
        if (!authenticated) return res.json({msg: '[ERROR] Permission denied: No authentication'})
        
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
        if (!authenticated) return res.json({msg: '[ERROR] Permission denied: No authentication'})
        
        console.log('Image received:', req.file.originalname);
        res.json({ msg: 'Image uploaded successfully', status: true });
    });

    // Main RDNS & Blocking endpoint.
    /* Stick to JSON. It's not noticeably slower, and user-friendly. */
    app.get('/resolve', async (req, res) => {

        const url = req.query.url;

        // Validate input format (protect against XSS)
        if (!(url && urlPattern.test(url))) 
            return res.status(400).send(`[ERROR] No valid URL format submitted!`);

        // Strip down the url to extract domain
        const domain = stripURLtoDomain(url);

        // Before resolving, check for forbidden domains via blocker.
        // What would the server expect as answer? 0.0.0.0? or just send "blocked"
        if (blocker.blocked(domain))
            return res.status(403).send({ error: "Domain is blocked." });

        // Try to resolve the domain via RDNS,
        // in case the IP cannot be resolved the resolve method 
        // returns a null IP i.e. 0.0.0.0
        const ip = await rdns.resolve(domain);
        
        // Send the IP which at this point should be defined.
        return res.send(ip);

    });


    // Let the server listen on specified port
    const server = http.createServer(app);
    server.listen(3000, () => {
        console.log('🚀 HTTP server running at http://localhost:3000');
    });



})()