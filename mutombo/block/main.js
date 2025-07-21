import { log, saveConfig, timestamp } from '../utils.js'

export class Blocker {
    /**
     * Loads all blocklist urls from config into cache. 
     * blocklistObject = {
     *  name: AdGuard DNS filter
     *  url: 'https://adguardteam.github.io/HostlistsRegistry/assets/filter_1.txt',
     *  date: 'creation_timestamp',
     *  active: true
     * }
     * @param {Array<object>} blocklists - Array of blocklist URLs to fetch.
     */
    constructor (config) {
        this.config                 = config;
        this.blocklists             = config.blocking.blocklists;
        this.blocklistEntryPattern  = /^(\|\|?|@)?[^\s]+?\^(\$[^\s]+)?$/;
        this.cache = {
            'blocklistSets': {}
        }
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
            if (!line.includes('||'))
                continue;
            let domain = line.replace('||', '').replace('^', '');
            blocklistDomainArray.push(domain);
        }

        // Convert the domain array into a set - to leverage its lookup capability
        const blocklistSet = new Set(blocklistDomainArray);

        // Remember the blocklist set by its name, now every IP can be quickly sourced.
        this.cache.blocklistSets[blocklistObject.name] = blocklistSet;

    }

    /**
     * Checks if a provided string payload is indeed a blocklist with block entries.
     * @param {object} blocklistObject - A blocklist object from config.blocking.blocklists
     * @returns {boolean}
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

    async addNewBlockList (raw_blocklist_url) {

        // Skip if the url is already known.
        for (list of this.blocklists) {
            if (list.url == raw_blocklist_url)
                return
        }

        // Create new blocklist object
        let blocklistObject = {
            name: raw_blocklist_url,
            url: raw_blocklist_url,
            date: timestamp(),
            active: true
        }

        // Fetch in plaintext
        const plaintext         = await (await fetch(url)).text();

        // Sanitary checks for format.
        const blockListFormat   = this.isBlocklist(plaintext);
        if (!blockListFormat)
            throw Error('The provided url yields no block list!')

        // Parse a proper list name
        for (let line of lines) {
            if (line.toLowerCase().includes('!') && line.toLowerCase().includes('title:')) {
                blocklistObject.name = line.toLowerCase().split('title:').slice(-1)[0].trim();
                break;
            }
        }

        // Cache the list right away
        this.cacheBlocklist(blocklistObject, plaintext);

        // Inject to config and save.
        this.config.blocking.blocklists.push(blocklistObject);
        saveConfig(this.config)
    }
}

(async () => {
    const b = new Blocker(['https://raw.githubusercontent.com/hagezi/dns-blocklists/refs/heads/main/adblock/blocklist-referral-native.txt']);
    await b.cacheBlocklists();
    console.log('debug', b.cache.blocklists)
})()
