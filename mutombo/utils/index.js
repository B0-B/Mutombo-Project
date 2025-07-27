// utils.js (ES Module version)
import fs from 'fs/promises';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { timeStamp } from 'console';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @typedef {number} Integer
 */

/**
 * Simple sleep function which accepts ms arguments.
 */
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Loads a JSON file and parses its content
 * @param {string} path - Path to the JSON file
 * @returns {Promise<Object>} - Parsed JSON object
 */
export async function loadJSON(path) {
  return JSON.parse(await fs.readFile(path, 'utf8'));
}

/**
 * Saves a JavaScript object as formatted JSON to a file
 * @param {string} path - Destination file path
 * @param {Object} data - JSON object to save
 * @returns {Promise<void>}
 */
export async function saveJSON(path, data) {
  console.log('Saving to', path, 'with data:', data);
  const json = JSON.stringify(data, null, 2); // pretty-print with indentation
  await fs.writeFile(path, json, 'utf8');
}

// ============ Config File Functions =============
export const configPath = path.join(__dirname, '../config.json')
/**
 * Saves the config to dedicated file path.
 * This function can be called in all modules and files.
 * @param {Object} config - config JSON-object to save
 * @returns {Promise<void>}
 */
export async function saveConfig(config) {
    await saveJSON(configPath, config)
}

/**
 * Loads the config file as json. This function can be called in all modules and files.
 * @returns {Promise<object>} - config file as json object.
 */
export async function loadConfig() {
    return await loadJSON(configPath)
}


/**
 * Updates the provided config reference or variable object with the newly sourced one.
 * @param {Object} configVariable - config JSON-object which should be updated.
 * @param {Object} updateTimeMs - time interval in which to update the config.
 */
export async function configUpdater (configVariable, updateTimeMs) {
  while (true) {
    try {
      const newConfig = await loadJSON('config.json'); // use same logic as initial load
      // Optional: do a sanity check or deep merge
      // Object.keys(configVariable).forEach(k => delete configVariable[k]);
      Object.assign(configVariable, newConfig);
    } catch (error) {
      // Fuse method, as the config can get out of place, 
      // once the reading fails with a syntax error, 
      // we just override it with the most recent state
      if (error instanceof SyntaxError) {
        await saveConfig(configVariable);
        console.log('[configUpdater] Rectify config ...')
      } else {
        console.error('Failed to reload config:', error);
      }
    } finally {
      await sleep(updateTimeMs)
    }
  }
}


/**
 * Hashes a payload with SHA-256 algorithm and returns the hex output.
 * @returns {String}
 */
export function _hash (payload) {
    return crypto.createHash('sha256').update(payload).digest('hex')    
}


/**
 * A fast strip down function which turns URLs securely into domain format.
 * Example: stripURLtoDomain('https://www.youtube.com/watch?v=') -> 'youtube.com'.
 * URLs can be just a domain or contain more info. Usually the domain is a subset of the domain.
 * In this case this function returns always just the domain part, no matter the input.
 * @param {string} URL - URL to strip
 * @returns {string} - Domain part as string
 */
export function stripURLtoDomain (URL) {
  // Remove potential edge whitespace.
  var domain = URL.trim();
  // Remove protocol tag
  if (URL.includes('http://')) {
    domain = URL.replace('http://', '')
  } else if (URL.includes('https://')) {
    domain = URL.replace('https://', '')
  }
  // Remove the "www." part, if present
  domain = domain.replace('www.', '');
  // Cut off anything after the first slash if paths are present
  if (domain.includes('/')) {
    domain = domain.split('/')[0]
  }
  return domain
}


// ============ Logging Mechanics =============

/**
 * A fast timestamp implementation which is useful in large loops and repeated calls.
 * Uses clever zero-padding without calling pad(), padStart() and some slicing. 
 * @returns {String} Timestamp in 'mm-dd-yy HH:MM' format.
 */
export function timestamp () {
  const d = new Date();
  return (
    ((d.getMonth() + 101).toString().slice(1)) + '/' +
    ((d.getDate() + 100).toString().slice(1)) + '/' +
    d.getFullYear().toString().slice(2) + ' ' +
    ((d.getHours() + 100).toString().slice(1)) + ':' +
    ((d.getMinutes() + 100).toString().slice(1))
  );
}

/**
 * A custom timestamp parser which is suitable for timestamp() function.
 * @returns {String} Timestamp in unix time in seconds.
 */
export function parseTimestamp(str) {
  const [datePart, timePart] = str.split(' ');
  const [month, day, year] = datePart.split('/').map(n => parseInt(n, 10));
  const [hours, minutes] = timePart.split(':').map(n => parseInt(n, 10));
  // Reconstruct full 4-digit year
  const fullYear = year >= 70 ? 1900 + year : 2000 + year;
  return Math.floor((new Date(fullYear, month - 1, day, hours, minutes)).getTime()/1000);
}

/**
 * A slick light-weight logger which handles timestamp and formatting.
 * @param {string} logPath -
 * @param {string} payload - The payload string to append to the file.
 */
export function log (logPath, payload) {
  fs.appendFile(logPath, timestamp() + '\t' + payload + '\n', err => {if (err) console.error("Log failed:", err);})
}

/**
 * @returns {String} Timestamp in string format 'mm-dd-yy HH:MM' from single log entry. 
 */
function timeFromLog (log) {
  return log.split('\t')[0];
}

/**
 * @param {string} log - Single log entry as string.
 * @returns {String} Unix timestamp in seconds from single log entry. 
 */
export function unixTimeFromLog (log) {
  return parseTimestamp(timeFromLog(log));
}

// ============ Statistics =============

/** Collects the domain in blocking scenario and creates all necessary entries in global stats object.
 * @param {string} domain domain which was blocked
 * @param {object} stats stats instance reference i.e. the global stats object
 * @param {string} type either 'blocks' or 'request'
 * @param {Request} req optional, allows to resolve more data into the stats object
 * @returns {Promise<void>}
 */
export async function collectRequestInfoForStats (domain, stats, type, req) {

  // Extract requestor and user agent information
  var agent, client;
  if (req) {
    agent = req.headers['user-agent'];
    client = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  } else {
    agent = 'n/a',
    client = 'n/a'
  }

  // Create a timeseries entry
  const timeString = timestamp();
  const timestamp = parseTimestamp(timeString);

  // *** TIMESERIES ENTRY FORMAT ***
  const entry = {
    domain,   // Requested domain
    client,   // The requestor IP
    agent,    // Requestor user agent
    time: timeString
  }

  // Aggregate the entry
  stats.dns[type].timeseries[timestamp] = entry;

  // Add the count by domain
  if (domain in stats.dns[type].by_domain) {
    stats.dns[type].by_domain[domain] = stats.dns[type].by_domain[domain] + 1;
  } else {
    stats.dns[type].by_domain[domain] = 1;
  }
  
  // Increment the total requests count
  stats.dns[type].total_events = stats.dns[type].total_events + 1;

}

/** 
 * Analyzes continuously the stats object.
 * @param {object} stats stats instance reference i.e. the global stats object
 * @param {Integer} updateTimeMs update time in milliseconds
 */
export async function analyzeStats (stats, updateTimeMs) {
  while (true) {
    try {
      // Analyze DNS stats
      // Sort requests and blocks 
      for (let type of ['resolutions', 'blocks']) {
        stats.dns[type].by_domain = Object.entries(stats.dns[type].by_domain)
        .sort(([, a], [, b]) => b.hits - a.hits)
        .reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {});
      }

      // Cutoff top n queried domains
      const top_n = 50;
      const topDomains = Object.entries(stats.dns.resolutions.by_domain).splice(0, top_n);
      let topList = {}
      for (let d of topDomains) {
        const requests = stats.dns.resolutions.by_domain[d];
        const share    = Math.floor(1000 * requests / stats.dns.resolutions.total_events) / 10 + '%';
        topList[d]     = {'Queries': requests, '%': share}; 
      }
      // Override top queried field in stats object
      stats.dns.top_queried_domains = topList;
      

    } catch (error) {
      console.log('[ERROR] in analyzeStats:', error)
    } finally {
      await sleep(updateTimeMs);
    }
  }
  
}