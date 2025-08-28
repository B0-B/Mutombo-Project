import { state } from './state.js';
import { saveContainerConfig, saveContainerState } from './api.js';
import { transition } from './ani.js';

// ======== Automatic Container Loading ========
/**
 * Places container automatically, according to coordinates in state object.
 * @param {string} containerName - The name of the container e.g. "navigation" 
 */
export function autoPlaceContainer (container) {
    // Retrieve intended container info from dashboard state
    const containerInfo = state.dashboard.containers[container.info.name];
    // const pos = containerInfo.position;
    let pos;
    // Modify container object
    if (containerInfo.config.collapsed) {
        pos = containerInfo.position.collapsed;
        container.info.position.collapsed = pos; // set the value in instance info
    } else {
        pos = containerInfo.position.expanded;
        container.info.position.expanded = pos; // set the value in instance info
    }
    // Modify container object
    container.element.style.left = pos[0] + 'px';
    container.element.style.top  = pos[1] + 'px';
    
}

export function autoConfigure (container) {
    // Source container info from latest state drawn in dashboard
    const containerConfig = state.dashboard.containers[container.info.name].config;
    // Set configuration styling from info object
    style(container.element, {
        backgroundColor: containerConfig.backgroundColor,
        webkitBackdropFilter: `blur(${containerConfig.blur}px)`, 
        backdropFilter: `blur(${containerConfig.blur}px)`,
    });
    // Change collapse state if not in sync
    if (container.settingsEnabled) {
        container.setCollapseState(containerConfig.collapsed);
    }
    // Place container 
    autoPlaceContainer(container);
}


/**
 * Allows to quickly create alements and assign identifiers
 * @param {string} tag - DOM tag type e.g. "div"
 * @param {string} id - DOM identifier e.g. "my-container"
 * @param {string|HTMLElement} parent_id - DOM identifier, or element of parent
 * @returns {HTMLElement} - Returns the just created DOM object.
 */
export function create (tag, id, parent_id) {
    const   el = document.createElement(tag);
    if (id) el.id = id;
    if (parent_id) {
        if (parent_id instanceof HTMLElement) {
            parent_id.appendChild(el);
        } else if (typeof parent_id === 'string') {
            const parentEl = document.getElementById(parent_id);
            parentEl?.appendChild(el);
        }
    } 
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
var activeContainer = null;
export class movingContainer {

    constructor (name, size=[200, 200], content="", heading="", dragEverywhere=false, settingsEnabled=true) {

        // -------- Container Registration --------
        // Define info object
        this.info = {
            name: name,
            id: `moving-container-${name}`,
            position: {
                expanded: [200, 200],
                collapsed: [200, 200]
            },
            size: size,
            config: {
                collapsed: false,
                blur: 2,
                backgroundColor: 'rgba(0,0,0,0.4)'
            }
        };

        // Create the root element for the moving container.
        this.element = create('span', this.info.id, 'page-dashboard');

        // Register element in dashboard state, but check and raise and 
        // exception if an entry already exists.
        if (name in state.elements) {
            this.element.remove(); // remove just created element.
            throw new Error(`Element "${name}" exists already!`);
        }
        // Otherwise add to elements object
        state.elements[name] = this.element;

        // Check if the container info was forwarded to state already. Otherwise add it.
        if (!(name in state.dashboard.containers)) {
            console.warn(`Register container "${name}" in state.dashboard.containers as no entry was found yet!`);
            state.dashboard.containers[name] = this.info;
        }

        // -------- Menu Mechanics --------
        // Container will only contain a menu object if enabled
        this.settingsEnabled = settingsEnabled;
        if (settingsEnabled) {

            const settingsHeight = 30;
            const settingsWidth = 100;
            this.menuEnabled = false;

            // Build menu frame
            this.menuWrapper = create('div', `container-${this.info.name}-menu-wrapper`, this.element);
            this.menuWrapper.classList.add('container', 'p-0');
            style(this.menuWrapper, {
                height: settingsHeight + 'px', 
                // display: 'inline-block',
                width: '100%', 
            });
            this.menuContainer = create('div', `container-${this.info.name}-menu-container`, this.menuWrapper);
            this.menuContainer.classList.add('row', 'g-0', 'd-flex', 'justify-content-end', 'menu-background-fade');
            style(this.menuContainer, {
                height: settingsHeight + 'px', 
                minHeight: settingsHeight + 'px',
                width: '100%',
                opacity: 0,
                transition: 'opacity 0.3s ease-in-out'
            });

            // Build minimization button
            const minimizeButtonCol = create('div', `container-${this.info.name}-menu-min-col`, this.menuContainer);
            minimizeButtonCol.classList.add('col-auto', 'p-0');
            this.minimizeButton     = create('button', `container-${this.info.name}-menu-min-btn`, minimizeButtonCol);
            this.minimizeButton.classList.add('min-button-style');
            this.minimizeSymbol =  create('span', ``, this.minimizeButton);
            style(this.minimizeSymbol, {width: '30px', height: '5px', borderRadius: '2px', backgroundColor: 'white'});
            this.maximizeSymbol =  create('span', ``, this.minimizeButton);
            this.maximizeSymbol.hidden = true;
            this.maximizeSymbol.innerHTML = '+';
            style(this.maximizeSymbol, {width: '30px', height: '30px', lineHeight: '30px', fontSize: '2rem', 
                fontWeight: 'bold', borderRadius: '2px', backgroundColor: 'rgba(0,0,0,0)', color:'white', padding: 0, margin: 0});

            // Add hovering mechanics
            this.element.addEventListener('mouseover', (e) => {
                // if (e.target !== this.element) return;

                const rect = this.element.getBoundingClientRect();
                const cursorX = e.clientX, 
                      cursorY = e.clientY; 

                // Curser is in the menu range
                if ( cursorY - rect.top <= settingsHeight && rect.right - cursorX <= settingsWidth) {
                    // 
                    console.log('visible')
                    this.menuEnabled = true;
                    this.menuContainer.style.opacity = 1;

                } 
                // Cursor is outside the menu range
                else if (this.menuEnabled) {
                    console.log('hidden');
                    this.menuEnabled = false;
                    this.menuContainer.style.opacity = 0;
                    
                }
            });

            // Clear up menu if the cursor leaves the moving container
            this.element.addEventListener('mouseleave', (e) => {
                this.menuEnabled = false;
                this.menuContainer.style.opacity = 0;
            });

            // Add the minimize-button click action
            this.minimizeButton.addEventListener('click', (e) => {
                this.toggleCollapse(); // toggle the collapse function
                // saveContainerConfig(this)
                saveContainerState(this);
            });
        }

        // Style the moving container element
        this.element.classList.add('moving-container-element', 'rounded', 'contour');
        style(this.element, {
            left: this.info.position[0] + 'px',
            top: this.info.position[1] + 'px',
            width: this.info.size[0] + 'px',
            height: this.info.size[1] + 'px',
            webkitBackdropFilter: `blur(${this.info.config.blur}px)`, 
            backdropFilter: `blur(${this.info.config.blur}px)`,
        });
        

        // -------- Header and Heading ---------
        // Define header and footer to be source-able.
        this.header = create('div', `container-${this.info.name}-header`, this.element);
        this.body = create('div', `container-${this.info.name}-body`, this.element);
        this.header.classList.add('moving-container-header');
        this.header.innerHTML=`<h1>${heading}</h1>`;
        this.header.style.color = 'white';
        this.body.innerHTML = content;

        
        // -------- Drag and drop mechanics --------
        this.clickOffset = [0, 0]; // relative mouse position internal element.
        // While the mouse is down on element (left click) and moving update the element position.
        this.draggingActive = false;
        // Arrow functions preserve `this` object.
        // Define the event listeners correspondingly.
        this.element.addEventListener('mousedown', (e) => {
            // Raise the element to front if a click happens above it
            focusContainer(this);
            // Ensure to only click on background or header
            if ( !dragEverywhere && 
                 ( e.target !== this.element && 
                   e.target !== this.header  && 
                   e.target !== this.menuWrapper &&
                   e.target !== this.menuContainer ) ) 
                return;
            activeContainer = this;
            // Activate dragging on left click action.
            if (e.button === 0) this.draggingActive = true;
            // Set the offset
            this.clickOffset = [e.offsetX, e.offsetY];
            
        });
        document.addEventListener('mouseup', (e) => {
            if (e.target !== this.minimizeButton && activeContainer === this && this.draggingActive) {
                this.draggingActive = false;
                const finalPosition = [e.pageX - this.clickOffset[0], e.pageY - this.clickOffset[1]];
                // const rect = this.element.getBoundingClientRect();
                // const finalPosition = [rect.x, rect.y];
                if (this.info.config.collapsed) {
                    this.info.position.collapsed = finalPosition;
                } else {
                    this.info.position.expanded = finalPosition;
                }
                // Dump the new position state
                saveContainerState(this);
                // Clear variable after save
                activeContainer = null; 
            }
        });
        document.addEventListener('mousemove', (e) => {
            if (activeContainer === this && this.draggingActive) {
                this.element.style.left = `${e.pageX - this.clickOffset[0]}px`;
                this.element.style.top  = `${e.pageY - this.clickOffset[1]}px`;
            }
        });


        // -------- Auto Actions after Build --------
        // Check if the container info was forwarded to state
        console.log('auto-place ' + name + ' at ', state.dashboard.containers[name].position);
        autoConfigure(this);
        // if (!(name in state.dashboard.containers)) {
        //     state.dashboard.containers[name] = this.info;
        // }
            
        // // Otherwise use the persistent state coordinates 
        // else {
        //     console.log('auto-place ' + name + ' at ', state.dashboard.containers[name].position);
        //     // autoPlaceContainer(this);
        //     autoConfigure(this);
        // }
    }
    /**
     * Toggles the collapse state of the container.
     * @returns {void}
     */
    toggleCollapse () {
        this.setCollapseState(!this.info.config.collapsed);
    };
    /**
     * Sets a provided collapse state for the moving container in UI. 
     * The state is handled in global state object and this instance.
     * @param {boolean} collapsed If true, the container will collapse, otherwise provide false.
     * @returns {void}
     */
    setCollapseState (collapsed) {
        // Container styling
        if (collapsed) {
            this.info.config.collapsed = true;
            this.body.hidden           = true;
            this.minimizeSymbol.hidden = true;
            this.maximizeSymbol.hidden = false;
            this.element.style.width   = 300 + 'px';
            this.element.style.height  = (this.header.offsetHeight + this.menuWrapper.offsetHeight + 20) + 'px';
        } else {
            this.body.hidden           = false;
            this.info.config.collapsed = false;
            this.minimizeSymbol.hidden = false;
            this.maximizeSymbol.hidden = true;
            this.element.style.width   = this.info.size[0] + 'px';
            this.element.style.height  = this.info.size[1] + 'px';
        }
        // Denote the resulting container configuration state in global state object.
        state.dashboard.containers[this.info.name].config.collapsed = this.info.config.collapsed;
        // Set the new position depending on collapse state
        autoPlaceContainer(this);
    }
}

/**
 * Creates a table from JSON file using the format:
 * var jsonData = [
 *  {
 *      "Book ID": "1",
 *      "Book Name": "Computer Architecture",
 *      "Category": "Computers",
 *      "Price": "125.60"
 *  }, ...
 * ]
 * and appends it to the provided parentId element.
 * @param {Array[object]} jsonList - Array of identically structured json objects.
 * @param {string} parentId - id of the parent element in which to place the table.
 * @param {boolean} resolveLinks - will detect and resolve links for interaction in cell entries, 
 * @param {string} cellOverflow - default: 'hidden', other could be line-break etc.
 * @param {boolean} outlines - default: false, will set outlines to table
 * @param {boolean} striped - if enabled will add alternating shades to table rows (for better readability)
 * @param {boolean} darkMode - only if striped is enabled will turn the stripe style dark.
 * @param {string} tableLayout - the table layout, default: fixed.
 * @param {string} verticalCellAlign - vertical alignment within the cell
 * @returns {HTMLElement} - the final table.
 */
export function createTableFromJSON (jsonList, 
                                     parentId,
                                     resolveLinks=true, 
                                     cellOverflow='hidden',
                                     outlines=false,
                                     striped=false, 
                                     darkMode=false,
                                     tableLayout='fixed', 
                                     verticalCellAlign='middle') {
    
    // EXTRACT VALUE FOR HTML HEADER. 
    // ('Book ID', 'Book Name', 'Category' and 'Price')
    var col = [];
    for (var i = 0; i < jsonList.length; i++) {
        for (var key in jsonList[i]) {
            if (col.indexOf(key) === -1) {
                col.push(key);
            }
        }
    }
    
    // CREATE DYNAMIC TABLE.
    var table = document.createElement("table");
    table.style.tableLayout = tableLayout;
    table.style.width = '100%'

    // Table styling (using bootstrap css classes)
    if (outlines) table.classList.add('table');
    if (darkMode) table.classList.add('table-dark');
    if (striped)  table.classList.add('table-striped');

    // CREATE HTML TABLE HEADER ROW USING THE EXTRACTED HEADERS ABOVE.
    var tr = table.insertRow(-1);                   // TABLE ROW.
    for (var i = 0; i < col.length; i++) {
        var th = document.createElement("th");      // TABLE HEADER.
        th.innerHTML = col[i];
        tr.appendChild(th);
    }

    // ADD JSON DATA TO THE TABLE AS ROWS.
    for (var i = 0; i < jsonList.length; i++) {

        tr = table.insertRow(-1);

        for (var j = 0; j < col.length; j++) {
            var tabCell = tr.insertCell(-1);

            // set vertical alignment in the td cell
            tabCell.style.overflow = cellOverflow;
            tabCell.style.verticalAlign = verticalCellAlign;
            
            // Format the content
            // If content is an http-like link
            var content;
            const rawContent = `${jsonList[i][col[j]]}`;
            if (resolveLinks && rawContent.includes('http')) {
                content = `<a href="${rawContent}" target="_blank" rel="noopener noreferrer">${rawContent}</a>`
            } else {
                content = rawContent
            }

            // fill content
            tabCell.innerHTML = content;
        }
    }

    // FINALLY ADD THE NEWLY CREATED TABLE WITH JSON DATA TO A CONTAINER.
    if (parentId) {
        var divContainer = document.getElementById(parentId);
        divContainer.appendChild(table);
    }

    return table
}

/**
 * Iterates through table rows and calls callback on cells which include any of the provided target values.
 * Skips header row. If no columnIndex is given, checks all columns.
 *
 * @param {HTMLElement} table - Table to operate on.
 * @param {string[]} targetValues - Array of strings to match.
 * @param {Function} callback - Called with (matchedCell, matchedValue, row).
 * @param {number} [columnIndex] - Optional index of the column to check. If omitted, checks all columns.
 */
export function filterTableByValues(table, targetValues, callback, columnIndex = null) {

    const rows = table.querySelectorAll('tbody tr');

    for (let i = 1; i < rows.length; i++) { // Skip header
        const cells = rows[i].querySelectorAll('td');

        const columnsToCheck = columnIndex !== null ? [columnIndex] : [...Array(cells.length).keys()];

        for (const col of columnsToCheck) {
            const cell = cells[col];
            const value = cell.textContent.trim();

            for (const target of targetValues) {
                if (value.includes(target)) {
                    callback(cell, target, rows[i]);
                }
            }
        }
    }
}

/**
 * Iterates through table rows and calls callback on cells which are in specific column.
 * @param {HTMLElement} table - Table to operate on.
 * @param {number} [columnIndex] - Optional index of the column to check. If omitted, checks all columns.
 * @param {Function} callback - Called with (matchedCell, row, col).
 */
export function filterTableByColumn (table, columnIndex, callback) {
    const rows = table.querySelectorAll('tbody tr');
    if (rows.length === 0) return;
    if (columnIndex < 0 || columnIndex >= rows[0].length) throw Error('columnIndex outside bounds.')
    for (let i = 1; i < rows.length; i++) { // Skip header
        const row = rows[i].querySelectorAll('td');
        const cell = row[columnIndex];
        callback(cell, i, columnIndex)
    }
}

/**
 * Modifies flexing table with column-wise spacing percentage.
 * @param {HTMLElement} table - Table to operate on.
 * @param {Array<number>} relativeSpacing - Array of relative spacings e.g. [0.2, 0.4, 0.1, 0.2, 0.1]. Note that all spacings need to add up to 1.
 * @returns {void}
 */
export function setRelativeColumnWidths (table, relativeSpacing) {
  const rows = table.querySelectorAll('tbody tr');
  if (rows.length < 2) return;

  const cellCount = rows[1].children.length;
  if (relativeSpacing.length !== cellCount) {
    throw new Error('"relativeSpacing" length must match column count.');
  }

  // Total width percentage must add up to 100%
  const total = relativeSpacing.reduce((sum, val) => sum + val, 0);
  const percents = relativeSpacing.map(r => (r / total) * 100);

  rows.forEach(row => {
    Array.from(row.children).forEach((cell, i) => {
      cell.style.width = `${percents[i]}%`;
    });
  });
}

/**
 * Styles an HTML element with a whole set of attributes at once.
 * @param {HTMLElement} element 
 * @param {object} stylingObject 
 * @returns {void}
 */
export function style (element, stylingObject) {
    Object.assign(element.style, stylingObject);
}

/**
 * 
 * @param {number} percentage Percentage value to map onto heat scale
 * @param {Array<number>} minColorRGB Lower end of the heat scale
 * @param {*} maxColorRGB Upper end of the heat scale
 * @returns {Array<number>} Resulting RGB array with numbers 0-255
 */
export function percentToHeatScale (percentage, minColorRGB, maxColorRGB, percentageCap=null) {
    // Compute the delta vector
    const delta = [
        maxColorRGB[0] - minColorRGB[0], 
        maxColorRGB[1] - minColorRGB[1], 
        maxColorRGB[2] - minColorRGB[2]
    ];

    let coefficient;
    if (percentageCap) {
        coefficient = Math.min([1, percentage / percentageCap]) 
    } else {
        coefficient = percentage / 100;
    }
    const convertedColor = [
        delta[0] * coefficient + minColorRGB[0],
        delta[1] * coefficient + minColorRGB[1],
        delta[2] * coefficient + minColorRGB[2],
    ];
    return convertedColor
}