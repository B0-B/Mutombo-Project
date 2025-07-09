/** Mutombo - Main Server Code **/

const fs = require('fs/promises'); // Use promise-based API
const path = require('path');
const multer = require('multer');
const http = require('http');
const express = require('express'); 

const { loadJSON, saveJSON, saveConfig, _hash } = require('./utils');


(async () => {
    
    const app       =   express();
    
    // Global authentication variable
    var config      = await loadJSON('config.json'); // load the config file
    var upload      = multer({ dest: 'data/img/' });

    // Globals
    var authenticated = false;

    // Serve static files from the "public" directory
    app.use(express.static(path.join(__dirname, 'public/static')));

    // ---- API endpoints ----
    // init endpoint

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
            return res.status(400).json({ msg: 'Invalid input', status: false });
        
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
        return res.json({msg: 'Blocked.', status: false});

    });

    // State change endpoint.
    app.use(express.json());
    app.post('/state', async (req, res) => {
        // Serve the most recent state.
        if (req.body.mode == 'get') {
            // Source the config
            config = await loadJSON('config.json');
            // Respond with state data
            return res.json({data: config.state})
        }
        // Complete override option
        else if (req.body.mode == 'override') {
            config.state = req.body.data;
            saveConfig(); // Save the config persistently.
            return res.json({status: true})
        }
        // Container override option
        else if (req.body.mode == 'container') {
            const container_info = req.body.data;
            config.state.dashboard.containers[container_info.name] = req.body.data;
            saveConfig(config); // Save the config persistently.
            return res.json({status: true})
        }
    });

    // Config delivery endpoint.
    app.use(express.json());
    app.post('/conf', async (req, res) => {
        const delimiter = '.';
        if (!req.body.mode)
            return res.json({msg: `/conf-endpoint: No "mode" parameter specified.`, data: {}});
        if (req.body.mode == 'get') {
            // Check for correct parameter
            // if (!req.body.key)
            //     return res.json({msg: "/conf-endpoint: No 'key' parameter specified in request!", data: {}});
            // if (!req.body.key in config)
            //     return res.json({msg: `/conf-endpoint: No key found in config with name "${key}"!`, data: {}});
            
            const keyChain = req.body.key.split('.');
            let currentKey = null;

            for (let currentKey of keyChain) {
                const element = array[currentKey];
                
            }
            const data = config[key];
            console.log('/conf-endpoint - requested data:', key);
            return res.json({msg: "Value to key: " + key, data: data})
        }

        else if (mode == 'set') {

        }
        
    });

    // Download endpoint.
    app.use(express.json());
    app.get('/download/:filename', (req, res) => {
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
        console.log('Image received:', req.file.originalname);
        res.json({ msg: 'Image uploaded successfully', status: true });
    });


    // Let the server listen on specified port
    const server = http.createServer(app);
    server.listen(3000, () => {
        console.log('🚀 HTTP server running at http://localhost:3000');
    });



})()