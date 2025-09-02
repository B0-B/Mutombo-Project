import { downloadFavicon, loadJSON, saveJSON,log, logDnsInfo, saveConfig, loadConfig, timestamp, sleep } from '#utils';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class Blocker {
    /**
     * Loads all blocklist urls from config into cache. 
     * blocklistObject = {
     *  name: AdGuard DNS filter
     *  url: 'https://adguardteam.github.io/HostlistsRegistry/assets/filter_1.txt',
     *  date: 'creation_timestamp',
     *  active: true
     * }
     * 
     * Every blocklistObject is sourced from scratch everytime the server restarts.
     * @param {Array<object>} blocklists - Array of blocklist URLs to fetch.
     * @returns {Promise<void>}
     */
    constructor (config) {

        this.config                 = config;
        this.blocklists             = config.blocking.blocklists;
        this.blocklistEntryPattern  = /^(\|\|?|@)?[^\s]+?\^(\$[^\s]+)?$/;

        this.servicePath = path.join(__dirname, '../services.json');

        // Browsing blocklists section
        this.blockBrowseList = {};

        // All blocklist files are fetched for all domains they contain and cached in the blocklistSets
        this.cache = {
            'services': {},
            'customDomainSet': new Set(), // Add a mutable set of all custom domains coming from disabled services
            'blocklistSets': {}
        }
        // Track statistics
        this.stats = {
            /*Standard request scheme 
            {
                timestamp: in ms,
                domain: ...,
                status: resolved | blocked
            }
            */
            'requests': {}
        }
    }

    /**
     * Fast method which checks if a domain exists in any blocklist, or in the custom domain set 
     * and thus if it is blocked.
     * @param {object} blocklistObject A blocklist object from config.blocking.blocklists
     * @returns {boolean} truth status on whether the provided domain is blocked.
     */
    blocked (domain) {
        // Convert to lowercase
        domain = domain.toLowerCase();
        // Check for custom domain set
        if (this.cache.customDomainSet.has(domain)) {
            logDnsInfo(domain, 'blocked', null, 'service panel');
            return true
        }

        // Check if the domain is in any blocklist.
        for (let listName in this.cache.blocklistSets) {

            // Leap-frog non-active blocklists
            if (!this.isActive(listName)) continue;

            // Derive domain set of the current blocklist
            let set = this.cache.blocklistSets[listName];
            
            // Lookup query of domain in domain set of current blocklist
            if (set.has(domain)) {// sets have fast table lookups
                // Log at this point as the list name is sourced already
                logDnsInfo(domain, 'blocked', null, listName);
                return true
            }
        }
        return false
    }

    /**
     * Loads all blocklists and caches their domains.
     * This function needs to be called and awaited after every initialization of a Blocker instance.
     * @returns {Promise<void>} 
     */
    async cacheFromConfig () {
        // Cache all blocklist objects from config
        for (let blocklistObj of this.config.blocking.blocklists)
            await this.cacheBlocklist(blocklistObj)
    }

    /**
     * Loads all domains for a blocklistObject and caches it.  
     * This function has to be called everytime the blocker is initialized as the domain tables are not stored.
     * @param {object} blocklistObject - A blocklist object from config.blocking.blocklists
     * @returns {Promise<void>}
     */
    async cacheBlocklist (blocklistObject, payload=null) {

        // Determine payload first, either by forwarding or by fetching.
        var plaintext;
        if (payload === null)
            plaintext = await (await fetch(blocklistObject.url)).text();
        else
            plaintext = payload;

        // Parse out all domains
        const lines     = plaintext.split('\n');
        let blocklistDomainArray = [];
        for (let line of lines) {
            if (line.includes('!') || line[0] === '#')
                continue;
            // For format "||example.com^"
            let domain = line.replace('||', '').replace('^', '');
            // For format "local=/2288.org/"
            domain = domain.replace('local=/', '').replace('/');
            // If 0 address is included "0.0.0.0 86apple.com"
            domain = domain.replace('0.0.0.0', '');
            // Trim the domain finally
            domain = domain.trim();
            // Add to domain array
            blocklistDomainArray.push(domain);
        }

        // Convert the domain array into a set - to leverage its lookup capability
        const blocklistSet = new Set(blocklistDomainArray);

        // Remember the blocklist set by its name, now every IP can be quickly sourced from the corr. set.
        this.cache.blocklistSets[blocklistObject.name] = blocklistSet;

        // If the blocklist is activated, add it to the global blocklist set
        // if (blocklistObject.active) this.addSet(blocklistSet);

    }

    /**
     * Checks if a provided string payload is indeed a blocklist with block entries.
     * @param {object} blocklistObject A blocklist object from config.blocking.blocklists
     * @returns {boolean} Boolean indicating if payload is a blocklist.
     */
    async isBlocklist(payload) {
        const lines = payload.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && this.blocklistEntryPattern.test(trimmed))
                return true; // Found a match—stop immediately
        }
        return false; // No match after scanning all lines
    }

    /**
     * Adds new blocklist object derived from url to config and directly sources all domains into the blocker.
     * @param {object} raw_blocklist_url - A blocklist url.
     * @param {object} label - A blocklist label for categorization.
     */
    async addNewBlockList (raw_blocklist_url, label, title) {

        try {

            // Freshly source the config file (in case of yet not tracked changes)
            this.config = await loadConfig();
            this.blocklists = this.config.blocking.blocklists;

            // Skip if the url is already known.
            for (let list of this.blocklists) {
                if (list.url == raw_blocklist_url)
                    throw Error(`The blocklist exists already!`)
            }

            // Create new blocklist object
            let blocklistObject = {
                name: raw_blocklist_url,
                url: raw_blocklist_url,
                label: label,
                date: timestamp(),
                active: true,
            }

            // Fetch in plaintext
            const plaintext         = await (await fetch(raw_blocklist_url)).text();

            // Sanitary checks for format.
            const blockListFormat   = this.isBlocklist(plaintext);
            if (!blockListFormat)
                throw Error('The provided url yields no block list!')

            // If a title is provided it will be applied as the list name.
            // Otherwise will parse a proper list title from the source.
            // If no name can be parse will use the first non-empty line of the source.
            if (title) {
                blocklistObject.name = title
            } else {
                const lines = plaintext.split('\n');
                let foundTitle = false;
                for (let line of lines) {
                    if ((line[0] === '!' || line[0] === '#') && line.toLowerCase().includes('title:')) {
                        foundTitle = true;
                        blocklistObject.name = line.toLowerCase().split('title:').slice(-1)[0].trim();
                        break;
                    }
                }
                if (!foundTitle) {
                    let line = lines[0], ind = 0;
                    while (line === '' || line === '\n') {
                        ind++;
                        line = lines[ind]
                    }
                    blocklistObject.name = line;
                }
            }
            

            // Cache the list right away to be accessible
            this.cacheBlocklist(blocklistObject, plaintext);

            // Inject to config and save.
            this.config.blocking.blocklists.push(blocklistObject);
            await saveConfig(this.config);

            console.log(`Successfully added new blocklist "${blocklistObject.name}".`)

        } catch (error) {
            
            console.log(`Failed to add blocklist:\n${error}`);
            throw Error(error)
            
        }
        

    }

    /**
     * Removes a blocklist from config and cache permanently.
     * @param {object} name - Name of the blocklist to remove.
     * @returns {Promise<void>}
     */
    async removeBlockList (name) {

        try {

            // Freshly source the config file (in case of yet not tracked changes)
            this.config = await loadConfig();
            this.blocklists = this.config.blocking.blocklists;

            // Iterate through blocklists array.
            let newBlockLists = [];
            for (let list of this.blocklists) {
                if (list.name !== name)
                    newBlockLists.push(list)
            }

            // Override cache and config
            delete this.cache.blocklistSets[name];
            this.config.blocking.blocklists = newBlockLists;
            this.blocklists                 = newBlockLists;
            await saveConfig(this.config);

            console.log(`Successfully removed blocklist "${name}".`)

        } catch (error) {
            
            console.log(`Failed to remove blocklist "${name}":\n${error}`)

        }
    }

    /**
     * Checks if a registered blocklist with provided name is active or not.
     * Will draw the result always from instance config.
     * @param {string} blockListName Name of the blocklist to query.
     * @returns {boolean} Activity status as boolean
     */
    isActive (blockListName) {
        for (let blocklist of this.config.blocking.blocklists) {
            if ( blocklist.name === blockListName )
                return blocklist.active
        }
    }

    // -------- Browsable Blocklists --------
    /**
     * Loads the browse list into the blocker instance.
     */
    async loadBlockBrowseList () {
        const browsePath = path.join(__dirname, 'browse.json');
        this.blockBrowseList = await loadJSON(browsePath);
    }   

    // -------- Services --------
    /**
     * Loads all services with their corr. endoints from services.json file.
     * Afterwards will forward to cache and customDomainSet.
     * @param {object} blocker - the Blocker() instance. 
     * @returns {object} services file as json.
     */
    async loadAndCacheServices () {
        // Load the services file as json
        const services = await loadJSON( this.servicePath );

        // Directly add the services object for persistency faster access to cache
        this.cache.services = services;

        // Now check for all states, if enabled add the endpoints to custom domain set.
        var service;
        for (const serviceDomain in services) {
            service = services[serviceDomain];
            if (service.blocked) {
                await this.blockService(serviceDomain, false);
            }
        }
    }
    /**
     * Blocks a service and all its endpoints.
     * @param {string} serviceDomain The service domain e.g. "facebook.com"
     * @param {boolean} [save=true] If the service file should be overriden, default is true.
     */
    async blockService (serviceDomain, save=true) {
        // Draw service object
        const service = this.cache.services[serviceDomain];
        // Disable the service
        service.blocked = true;
        // Add all its endpoints to the customDomainSet
        for (const endpoint of service.endpoints) {
            this.cache.customDomainSet.add(endpoint)
        }
        // Dump the new state if save flag is enabled
        if (save) await saveJSON(this.servicePath, this.cache.services);
    }
    /**
     * Unblocks a service and all its endpoints.
     * @param {string} serviceDomain The service domain e.g. "facebook.com"
     * @param {boolean} [save=true] If the service file should be overriden, default is true.
     */
    async unblockService (serviceDomain, save=true) {
        // Draw service object
        const service = this.cache.services[serviceDomain];
        // Disable the service
        service.blocked = false;
        // Add all its endpoints to the customDomainSet
        for (const endpoint of service.endpoints) {
            this.cache.customDomainSet.delete(endpoint)
        }
        // Dump the new state if save flag is enabled
        if (save) await saveJSON(this.servicePath, this.cache.services);
    }

    /**
     * [Deprecated]
     * Downloads all service favicon icons in parallel. The function 
     * blocks until all downloads are finished.
     * @param {number} [timeOut=1000] timeout of each request
     */
    async downloadServiceFavicons (timeOut=1000) {
        console.log('[Blocker] Download all service favicons ...');
        const domains = Object.keys(this.cache.services);
        const downloadTasks = domains.map(domain => downloadFavicon(domain, 'favicon.ico', timeOut));
        await Promise.all(downloadTasks);
        console.log('[Blocker] All favicons downloaded.');
    }
}

// (async () => {
//     let config = await loadJSON('../config.json');
//     const b = new Blocker(config);
//     await b.cacheFromConfig();
//     // await b.addNewBlockList('https://adguardteam.github.io/HostlistsRegistry/assets/filter_1.txt')
//     console.log('set', b.cache.blocklistSets['adguard dns filter'])
//     console.log('albss.com blocked:', b.blocked('albss.com'))
//     console.log('youtube.com blocked:', b.blocked('youtube.com'))
//     // await b.removeBlockList('adguard dns filter')
// })()
