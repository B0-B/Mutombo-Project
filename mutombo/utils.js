const fs = require('fs/promises');
const crypto = require('crypto');
const { time } = require('console');

/**
 * Simple sleep function which accepts ms arguments.
 */
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Loads a JSON file and parses its content
 * @param {string} path - Path to the JSON file
 * @returns {Promise<Object>} - Parsed JSON object
 */
async function loadJSON(path) {
  return JSON.parse(await fs.readFile(path, 'utf8'));
}

/**
 * Saves a JavaScript object as formatted JSON to a file
 * @param {string} path - Destination file path
 * @param {Object} data - JSON object to save
 * @returns {Promise<void>}
 */
async function saveJSON(path, data) {
  console.log('Saving to', path, 'with data:', data);
  const json = JSON.stringify(data, null, 2); // pretty-print with indentation
  await fs.writeFile(path, json, 'utf8');
}

/**
 * Saves the config to dedicated file path
 * @param {Object} config - config JSON-object to save
 * @returns {Promise<void>}
 */
async function saveConfig(config) {
    await saveJSON('config.json', config)
}


/**
 * Updates the provided config reference or variable object with the sourced.
 * @param {Object} configVariable - config JSON-object which should be updated.
 * @param {Object} updateTimeMs - time interval in which to update the config.
 */
async function configUpdater (configVariable, updateTimeMs) {
  while (true) {
    try {
      const newConfig = await loadJSON('config.json'); // use same logic as initial load
      // Optional: do a sanity check or deep merge
      // Object.keys(configVariable).forEach(k => delete configVariable[k]);
      Object.assign(configVariable, newConfig);
    } catch (err) {
      console.error('Failed to reload config:', err);
    } finally {
      await sleep(updateTimeMs)
    }
  }
}


/**
 * Hashes a payload with SHA-256 algorithm and returns the hex output.
 * @returns {String}
 */
function _hash (payload) {
    return crypto.createHash('sha256').update(payload).digest('hex')    
}

// ============ Logging Mechanics =============

/**
 * A fast timestamp implementation which is useful in large loops and repeated calls.
 * Uses clever zero-padding without calling pad(), padStart() and some slicing. 
 * @returns {String} Timestamp in 'mm-dd-yy HH:MM' format.
 */
function timestamp () {
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
function parseTimestamp(str) {
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
function log (logPath, payload) {
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
function unixTimeFromLog (log) {
  return parseTimestamp(timeFromLog(log));
}

// Export all methods.
module.exports = {
    sleep,
    loadJSON, 
    saveJSON, 
    saveConfig,
    configUpdater,
    _hash,
    timestamp,
    log
};