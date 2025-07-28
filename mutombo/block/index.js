import { loadJSON, log, saveConfig, loadConfig, timestamp, sleep } from '#utils';

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
        // All blocklist files are fetched for all domains they contain and cached in the blocklistSets
        this.cache = {
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
     * Fast method which checks if a domain exists in any blocklist and thus if it is blocked.
     * @param {object} blocklistObject A blocklist object from config.blocking.blocklists
     * @returns {boolean} truth status on whether the provided domain is blocked.
     */
    blocked (domain) {
        for (let listName in this.cache.blocklistSets) {

            // Leap-frog non-active blocklists
            if (!this.isActive(listName)) continue;

            // Derive domain set of the current blocklist
            let set = this.cache.blocklistSets[listName];
            
            // Lookup query of domain in domain set of current blocklist
            if (set.has(domain)) // sets have fast table lookups
                return true

        }
        return false
    }

    /**
     * Adds new blocklist object derived from url to config and directly sources all domains into the blocker.
     * @param {object} raw_blocklist_url - A blocklist url.
     * @param {object} label - A blocklist label for categorization.
     */
    async addNewBlockList (raw_blocklist_url, label) {

        try {

            // Freshly source the config file (in case of yet not tracked changes)
            this.config = await loadConfig();
            this.blocklists = this.config.blocking.blocklists;

            // Skip if the url is already known.
            for (let list of this.blocklists) {
                if (list.url == raw_blocklist_url)
                    return
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

            // Parse a proper list name
            const lines = plaintext.split('\n');
            for (let line of lines) {
                if ((line[0] === '!' || line[0] === '#') && line.toLowerCase().includes('title:')) {
                    blocklistObject.name = line.toLowerCase().split('title:').slice(-1)[0].trim();
                    break;
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
