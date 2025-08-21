/* API functions */

import { movingContainer } from './container.js';
import { state } from './state.js';

/**
 * Downloads a requested file from the server and returns the upload URL.
 * The URL can be used in containers like <img src="..."> or <video src="...">
 * @param {string} filename - The name of the file to request. 
 * @returns {string} - Returns the uploaded blob URL.
 */
export async function download (filename) {
    const response = await fetch(`download/${filename}`);
    // Check for errors.
    if (!response.ok)
        throw new Error('File not found!');
    // Load image into the session
    const blob = await response.blob(); // large object structure for video, images, sound etc.
    const url = URL.createObjectURL(blob);
    // Register download in dashboard state
    state.downloads.push(url);
    // Return url only
    return url
}


/**
 * Retrieves general value corr. to provided key defined in server-side config file.
 * @param {string} mode - Request mode "get" or "set".
 * @param {string} key - The key to request. Multiple keys can be chained as key1.key2.key3...
 * @param {any} data - The data value to set at the key path (for set mode only).
 * @returns {Promise<any>} - Returns the corr. config value.
 */
export async function config (mode, key, data={}) {
    const res = await fetch('/conf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key, mode: mode, data: data })
    });
    return (await res.json()).data;
}

/**
 * Retrieves the search engine URL defined in server-side config file.
 * @returns {string} - Returns the search engine URL.
 */
export async function getSearchEndpoint () {
    return await config("get", "searchEngineURL");
}


/**
 * Loads the dashboard background image into provided HTML element.
 * @param {HTMLElement} element - The name of the file to request. 
 */
export async function loadBackground (element) {
    const filename = 'dashboard-background';
    for (let ext of ['.jpg', '.jpeg', '.png']) {
        try {
            let blobURL = await download(filename + ext);
            element.style.backgroundImage = `url(${blobURL})`;
            return
        } catch (error) {
            //
        }
    }
}


/**
 * Loads the persistent dashboard state from server to client backend.
 * @param {HTMLElement} element - The name of the file to request. 
 */
export async function loadState () {
    // fetch the result from state endpoint
    const res = await fetch('/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'get' })
    });
    const result = await res.json();
    let _state = result.data;
    // Override global state.dashboard variable
    if (_state)
        state.dashboard = _state.dashboard;
    console.log('state', state)
}


/**
 * Saves the state of the provided container in global state object and syncs with server config.
 * @param {movingContainer} container - The container which to save.
 */
export function saveContainerState (container) {
    state.dashboard.containers[container.info.name] = container.info;
    // Send change to server
    // fetch the result from state endpoint
    fetch('/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'container', data: container.info })
    });
}


/**
 * Saves the container configuration.
 * @param {movingContainer} container - The container which to save.
 */
export function saveContainerConfig (container) {
    // Extract currently set container config from container object in dashboard interface
    const containerObjectConfig = container.info.config;
    // Override container config information in global state object
    state.dashboard.containers[container.info.name].config = containerObjectConfig;
    // Send change to server
    // fetch the result from state endpoint
    fetch('/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'container', data: container.info })
    });
}