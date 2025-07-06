import { state } from './state.js';

/**
 * Allows to quickly create alements and assign identifiers
 * @param {string} tag - DOM tag type e.g. "div"
 * @param {string} id - DOM identifier e.g. "my-container"
 * @param {string} parent_id - DOM identifier of parent element
 * @returns {HTMLElement} - Returns the just created DOM object.
 */
function create (tag, id, parent_id) {
    const   el = document.createElement(tag);
            el.id = id;
    if (parent_id) document.getElementById(parent_id).appendChild(el);
    return el;
}


/**
 * Downloads a requested file from the server and returns the upload URL.
 * The URL can be used in elements like <img src="..."> or <video src="...">
 * @param {string} filename - The name of the file to request. 
 * @returns {string} - Returns the uploaded blob URL.
 */
async function download (filename) {
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
 * Downloads a requested file from the server and returns the upload URL.
 * The URL can be used in elements like <img src="..."> or <video src="...">
 * @param {string} filename - The name of the file to request. 
 * @returns {string} - Returns the uploaded blob URL.
 */
function focusContainer (container) {
    // Move all containers to background 
    for (let containerName in state.dashboard.elements)
        document.getElementById(state.dashboard.elements[containerName].id).style.zIndex = 999;
    // Bring selected container to front
    container.element.style.zIndex = 1000;
}

/**
 * Saves the state of the provided container in global state object.
 * @param {HTMLElement} container - The container which to save.
 */
function saveContainerState (container) {
    state.dashboard.elements[container.info.name] = container.info;
    // Send change to server
    // fetch the result from state endpoint
    fetch('/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'container', data: container.info })
    });
}

/**
 * Creates a drag-able UI container in the dashboard which can serve HTML content.
 * The container will register in the dashboard state and server.
 * @param {string} name - Unique container name which will define it identifier as "moving-container-<name>"
 * @param {Array[int]} size - Container size in pixels e.g. [200, 400].
 * @param {string} content - The inner html content to display.
 */
export class movingContainer {

    constructor (name, size=[200, 200], content="") {

        this.info = {};
        this.info.name = name;
        this.info.id = `moving-container-${name}`;
        this.info.blur = 2; // background blur in pixel
        this.info.position = [200, 200];
        this.info.size = size;

        // Create element.
        this.element = create('span', this.info.id, 'page-dashboard');

        // Style the element
        this.element.style.position = 'absolute';
        this.element.style.display = 'block';
        this.element.style.backgroundColor = 'rgba(0,0,0,0.4)';
        this.element.style.left     = this.info.position[0] + 'px';
        this.element.style.top      = this.info.position[1] + 'px';
        this.element.style.width  = this.info.size[0] + 'px';
        this.element.style.height = this.info.size[1] + 'px';
        this.element.style.webkitBackdropFilter = `blur(${this.info.blur}px)`; // For Safari
        this.element.style.backdropFilter = `blur(${this.info.blur}px)`;
        this.element.classList.add('rounded', 'contour');

        // Add content
        this.element.innerHTML = content;

        // Check if the name is unique in dashboard state.
        // If it does not exist 
        if (name in state.dashboard.elements)
            throw new Error(`Element "${name}" exists already!`);
        else
            state.dashboard.elements[name] = this.info;
        
        // Drag and drop mechanics.
        this.clickOffset = [0, 0]; // relative mouse position internal element.
        // While the mouse is down on element (left click) and moving update the element position.
        this.draggingActive = false;
        // Arrow functions preserve `this` object.
        // Define the event listeners correspondingly.
        this.element.addEventListener('mousedown', (e) => {
            // Raise the element to front
            focusContainer(this);
            // Activate dragging on left click action.
            if (e.button === 0) this.draggingActive = true;
            // Set the offset
            this.clickOffset = [e.offsetX, e.offsetY];
            
        });
        document.addEventListener('mouseup', (e) => {
            this.draggingActive = false;
            // Once the mouse is released save the position and save the state
            this.info.position      = [e.pageX, e.pageY];
            saveContainerState(this);
        });
        document.addEventListener('mousemove', (e) => {
            if (!this.draggingActive) return;
            this.element.style.left = `${e.pageX - this.clickOffset[0]}px`;
            this.element.style.top  = `${e.pageY - this.clickOffset[1]}px`;
        });
    }
}


/**
 * Loads the persistent dashboard state from server to client backend.
 * @param {HTMLElement} element - The name of the file to request. 
 */
async function loadState () {
    // fetch the result from state endpoint
    const res = await fetch('/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'get' })
    });
    const result = await res.json();
    let _state = result.data;
    // Override global state variable
    if (_state)
        state.dashboard = _state.dashboard;
}


/**
 * Loads the dashboard background image into provided HTML element.
 * @param {HTMLElement} element - The name of the file to request. 
 */
async function loadBackground (element) {
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

async function loadNavigation () {
    let navi = new movingContainer('navigation');
}

export async function dashPage (params) {
    
    const app = document.getElementById('app');

    // Clear the app container
    app.innerHTML = '';

    // Add the dashboard page to the app container
    const page = create('div', 'page-dashboard', 'app');

    // Run init tasks
    loadState();
    loadBackground(page);
    loadNavigation();
}