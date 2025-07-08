import { state } from './state.js';
import { saveContainerState } from './api.js';

/**
 * Places container automatically, according to coordinates in state object.
 * @param {string} containerName - The name of the container e.g. "navigation" 
 */
export async function autoPlaceContainer (containerName) {
    const containerInfo = state.dashboard.containers[containerName];
    const container = document.getElementById(containerInfo.id)
    const pos = containerInfo.position;
    console.log('pos', pos);
    container.style.left = pos[0] + 'px';
    container.style.top = pos[1] + 'px';
}


/**
 * Allows to quickly create alements and assign identifiers
 * @param {string} tag - DOM tag type e.g. "div"
 * @param {string} id - DOM identifier e.g. "my-container"
 * @param {string} parent_id - DOM identifier of parent element
 * @returns {HTMLElement} - Returns the just created DOM object.
 */
export function create (tag, id, parent_id) {
    const   el = document.createElement(tag);
            el.id = id;
    if (parent_id) document.getElementById(parent_id).appendChild(el);
    return el;
}


/**
 * Downloads a requested file from the server and returns the upload URL.
 * The URL can be used in containers like <img src="..."> or <video src="...">
 * @param {string} filename - The name of the file to request. 
 * @returns {string} - Returns the uploaded blob URL.
 */
export function focusContainer (container) {
    // Move all containers to background 
    for (let containerName in state.elements)
        state.elements[containerName].style.zIndex = 999;
    // Bring selected container to front
    container.element.style.zIndex = 1000;
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
        // Register element in dashboard state.
        if (name in state.elements)
            throw new Error(`Element "${name}" exists already!`);
        state.elements[name] = this.element;
        // Check if the container info was forwarded to state
        if (!name in state.dashboard.containers)
            state.dashboard.containers[name] = this.info;
        // Otherwise use the persistent state coordinates 
        else {
            console.log('auto-place ' + name + ' at ', state.dashboard.containers[name].position);
            autoPlaceContainer(name);
        }

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
            this.info.position      = [e.pageX - this.clickOffset[0], e.pageY - this.clickOffset[1]];
            saveContainerState(this);
        });
        document.addEventListener('mousemove', (e) => {
            if (!this.draggingActive) return;
            this.element.style.left = `${e.pageX - this.clickOffset[0]}px`;
            this.element.style.top  = `${e.pageY - this.clickOffset[1]}px`;
        });
    }
}


