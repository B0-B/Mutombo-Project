const fs = require('fs/promises');
const crypto = require('crypto');

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
 * Hashes a payload with SHA-256 algorithm and returns the hex output.
 * @returns {String}
 */
function _hash (payload) {
    return crypto.createHash('sha256').update(payload).digest('hex')    
}

// Export all methods.
module.exports = {
    loadJSON, 
    saveJSON, 
    saveConfig,
    _hash
};