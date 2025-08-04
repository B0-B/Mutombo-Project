import { state } from './state.js';
import { loadBackground, loadState, getSearchEndpoint, config } from './api.js';
import { create, 
         movingContainer, 
         focusContainer, 
         autoPlaceContainer, 
         createTableFromJSON, 
         filterTableByValues,
         filterTableByColumn,
         setRelativeColumnWidths,
         style } from './container.js';
import { aggregateTimeseriesArray, timesArray } from './timeseries.js';
import { sessionTimeoutLoop } from './auth.js';

// Register plugin BEFORE instantiating the chart
// Chart.register(ChartDataLabels);

// ============ Navigation Container ============
/**
 * Loads the navigation container.
 */
async function loadNavigation () {

    // Parameters
    const navWidth  = 300;
    const navHeight = 60;
    const navElementHeight = Math.floor(0.6 * navHeight);
    const navFontSize = Math.floor(0.618**2 * navHeight);
    const hoverScaleFactor = 1.05;

    // Create a search navigation and auto-place it
    let navi = new movingContainer('navigation', [ navWidth, navHeight ]);
    navi.header.remove();
    autoPlaceContainer('navigation');

    // Extract body element
    const containerBody = navi.body;
    containerBody.classList.add('container');

    // ==== Navigation Search Bar ====
    // ---- HTML Structure ----
    let searchRow = create('div', 'nav-search-bar-container', containerBody);
    style(searchRow, {height: '40px', marginTop: '10px'});
    searchRow.classList.add('row', 'no-gutters');
    let searchInputCol  = create('div', 'nav-search-input-col', searchRow);
    searchInputCol.classList.add('col-9');
    let searchInput     = create('input', 'nav-search-bar-input', searchInputCol);
    searchInput.style.height = '100%';
    searchInput.placeholder = 'web search ...';
    searchInput.classList.add('rounded-input');
    searchInput.style.width = '100%'
    let searchButtonCol = create('div', 'nav-search-button-col', searchRow);
    searchButtonCol.classList.add('col-3', 'p-0');
    let searchButton    = create('button', 'nav-search-bar-button', searchButtonCol);
    searchButton.classList.add('rounded-button');

    // Retrieve current search engine endpoint
    const searchEngineEndpoint = await getSearchEndpoint();
    console.log('search engine:', searchEngineEndpoint);

    // Event listener for enter key submission, works only while the input is focused.
    searchInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            // Optionally prevent form submission if inside a form
            event.preventDefault();
            searchButton.click();
        }
    });
    // style search button
    function renderSVG(height) {
        return `
            <svg id="nav-search-bar-search-icon" xmlns="http://www.w3.org/2000/svg"  width="50" height="${height}" viewBox="0 0 128 128">
                <path fill="white" d="M 52.349609 14.400391 C 42.624609 14.400391 32.9 18.1 25.5 25.5 C 10.7 40.3 10.7 64.399219 25.5 79.199219 C 32.9 86.599219 42.600391 90.300781 52.400391 90.300781 C 62.200391 90.300781 71.900781 86.599219 79.300781 79.199219 C 94.000781 64.399219 93.999219 40.3 79.199219 25.5 C 71.799219 18.1 62.074609 14.400391 52.349609 14.400391 z M 52.300781 20.300781 C 60.500781 20.300781 68.700391 23.399219 74.900391 29.699219 C 87.400391 42.199219 87.4 62.5 75 75 C 62.5 87.5 42.199219 87.5 29.699219 75 C 17.199219 62.5 17.199219 42.199219 29.699219 29.699219 C 35.899219 23.499219 44.100781 20.300781 52.300781 20.300781 z M 52.300781 26.300781 C 45.400781 26.300781 38.9 29 34 34 C 29.3 38.7 26.700391 44.800391 26.400391 51.400391 C 26.300391 53.100391 27.600781 54.4 29.300781 54.5 L 29.400391 54.5 C 31.000391 54.5 32.300391 53.199609 32.400391 51.599609 C 32.600391 46.499609 34.699219 41.799219 38.199219 38.199219 C 41.999219 34.399219 47.000781 32.300781 52.300781 32.300781 C 54.000781 32.300781 55.300781 31.000781 55.300781 29.300781 C 55.300781 27.600781 54.000781 26.300781 52.300781 26.300781 z M 35 64 A 3 3 0 0 0 32 67 A 3 3 0 0 0 35 70 A 3 3 0 0 0 38 67 A 3 3 0 0 0 35 64 z M 83.363281 80.5 C 82.600781 80.5 81.850781 80.800391 81.300781 81.400391 C 80.100781 82.600391 80.100781 84.499609 81.300781 85.599609 L 83.800781 88.099609 C 83.200781 89.299609 82.900391 90.6 82.900391 92 C 82.900391 94.4 83.8 96.700391 85.5 98.400391 L 98.300781 111 C 100.10078 112.8 102.39922 113.69922 104.69922 113.69922 C 106.99922 113.69922 109.29961 112.79961 111.09961 111.09961 C 114.59961 107.59961 114.59961 101.90039 111.09961 98.400391 L 98.300781 85.599609 C 96.600781 83.899609 94.300391 83 91.900391 83 C 90.500391 83 89.2 83.300391 88 83.900391 L 85.5 81.400391 C 84.9 80.800391 84.125781 80.5 83.363281 80.5 z M 91.900391 88.900391 C 92.700391 88.900391 93.5 89.200781 94 89.800781 L 106.69922 102.5 C 107.89922 103.7 107.89922 105.59922 106.69922 106.69922 C 105.49922 107.89922 103.6 107.89922 102.5 106.69922 L 89.800781 94.099609 C 89.200781 93.499609 88.900391 92.700391 88.900391 91.900391 C 88.900391 91.100391 89.200781 90.300781 89.800781 89.800781 C 90.400781 89.200781 91.100391 88.900391 91.900391 88.900391 z"/>
            </svg>
        `;
    }
    style(searchButton, {
        background: 'rgba(0, 0, 0, 0)',
        display: 'inline-flex',
        alignItems: 'center',
        verticalAlign: 'middle',
        justifyContent: 'center',
        border: 'none',
        outline: 'none',
        boxShadow: 'none',
        padding: '0',
        height: navElementHeight + 'px'
    });
    searchButton.innerHTML = renderSVG(navElementHeight);
    searchButton.excited = false;
    searchButton.addEventListener('mouseover', () => {
        if (searchButton.excited)
            return;
        searchButton.excited = true;
        searchButton.innerHTML = renderSVG(Math.floor( hoverScaleFactor * navElementHeight ));
    });
    searchButton.addEventListener('mouseleave', () => {
        searchButton.excited = false;
        searchButton.innerHTML = renderSVG(navElementHeight);
    });
    searchButton.addEventListener('click', () => {
        const query = searchInput.value;
        // Navigate to search engine endpoint
        // window.location.href = searchEngineEndpoint + searchInput.value;
        window.location.href = `${searchEngineEndpoint}?q=${encodeURIComponent(query)}`;
    });
}

async function hashURL (url) {
  const encoder = new TextEncoder();
  const data = encoder.encode(url);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ============ Blocklist Container ============
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Loads the content to previously constructed container.
 * @param {movingContainer} container movingContainer instance
 * @returns {Promise<void>}
 */
async function  loadBlocklistContainerContent (container) {

    let containerBody = container.body;
    containerBody.innerHTML = '';
    containerBody.classList.add('container');
    containerBody.style.paddingLeft = '20px';
    containerBody.style.paddingRight = '20px';

    // Request blocklists from server
    const blocklists = await config('get', 'blocking.blocklists');
    console.log('blocklists', blocklists);

    // -------- Add New Blocklist Utility --------
    const inputWrapper = create('div', 'blocklists-input-wrapper', containerBody);
    inputWrapper.classList.add('row', 'justify-content-md-center', 'no-gutters');
    inputWrapper.style.marginBottom = '20px';
    inputWrapper.style.marginTop = '20px';

    // Input for URL
    const inputCol = create('div', '', inputWrapper);
    inputCol.classList.add('col-6');
    const newBlocklistInput = create('input', 'blocklist-input', inputCol);
    newBlocklistInput.type = 'text';
    newBlocklistInput.style.width = '100%';
    newBlocklistInput.classList.add('bg-dark-medium');
    newBlocklistInput.placeholder = 'Add blocklist URL ...';

    // Select element for blocklist label selection
    const  selectCol = create('div', '', inputWrapper);
    selectCol.classList.add('col-4');
    const newBlocklistSelect = create('select', 'blocklist-label-select', selectCol);
    newBlocklistSelect.style.width = '100%';
    newBlocklistSelect.style.height = '100%';
    newBlocklistSelect.classList.add('bg-dark-medium');
    // Create the placeholder option
    const placeholder = document.createElement("option");
    placeholder.textContent = "Select Category";
    placeholder.value = "";
    placeholder.disabled = true;
    placeholder.selected = true;
    newBlocklistSelect.options.add(placeholder);
    // Add other real selectable labels
    const labels = ['ad', 'general', 'mixed', 'security', 'other'];
    labels.forEach((label) => {
        let option = create('option', `new-blocklist-${label}-option`);
        option.text = label;
        option.classList.add('bg-dark-medium')
        newBlocklistSelect.options.add(option)
    })

    // Add submit button
    const  submitCol = create('div', '', inputWrapper);
    submitCol.classList.add('col-2');
    const submitButton = create('button', '', submitCol);
    style(submitButton, { border: 0, backgroundColor: '#167adeff', color: '#fff', height: '100%' });
    submitButton.innerHTML = 'Add';
    submitButton.classList.add('rounded-button');

    // Submit routine
    submitButton.addEventListener('click', async () => {
        
        console.log('submit blocklist url ...')
        const blocklistUrl   = newBlocklistInput.value;
        const blocklistLabel = newBlocklistSelect.value;
        
        // Send url and label to server
        const response = await (await fetch('/state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'blocklist', type: 'add', url: blocklistUrl, label: blocklistLabel })
        })).json();

        // Add entry to table
        await sleep(100); // delay to give the server some time to settle
        // configawait config('get', 'blocking.blocklists');
        await loadBlocklistContainerContent(container);

        // Output the server response in input placeholder
        await sleep(100);
        const _newBlocklistInput = document.getElementById('blocklist-input');
        _newBlocklistInput.value = '';
        const originalColor = _newBlocklistInput.style.color;
        if (response.err) {
            _newBlocklistInput.placeholder = response.err.replace('Error: ', ''); // delete input in UI
            _newBlocklistInput.style.setProperty('--c', '#e91f4bff');
        } else {
            _newBlocklistInput.placeholder = response.msg;
            _newBlocklistInput.style.setProperty('--c', '#0ee182ff');
        }
        await sleep(5000); // little delay
        _newBlocklistInput.style.color = originalColor;
        _newBlocklistInput.placeholder = 'blocklist URL ...';

    });

    // -------- Blocklist Table --------
    const blockListWrapper = create('div', 'blocklist-overview', containerBody);
    blockListWrapper.classList.add('row');
    style(blockListWrapper, {
        maxHeight: '100%',            // Set height threshold
        overflowY: 'scroll',           // Enable vertical scroll
        scrollbarWidth: 'none'         // Hide scrollbar in Firefox
    });
    const blockListTable = createTableFromJSON(blocklists, 'blocklist-overview');
    blockListTable.id = 'blocklist-table';
    blockListTable.style.color = 'white';
    

    // Manipulate table to include a row of switches for enabling/disabling blocklists
    filterTableByValues(blockListTable, ['true', 'false'], async (matchedCell, matchedValue, row) => {

        // Unpack rows
        const rowEntries = row.querySelectorAll('td');
        let blockListName = rowEntries[0].textContent.trim();
        let url = rowEntries[1].textContent.trim();

        // Safe url hash for id
        let safeUrl = await hashURL(url);

        // Build unique toggler
        let toggleId = `toggler-${safeUrl}`;
        console.log('hash', url, safeUrl)
        matchedCell.innerHTML = ''; // remove value from cell first 
        const switchWrapper = create('div', `switch-wrapper-${url}`, matchedCell);
        switchWrapper.classList.add('form-check', 'form-switch');
        const toggler       = create('input', toggleId, switchWrapper);
        toggler.classList.add('form-check-input');
        style(toggler, {boxShadow: 'none', userSelect: 'none'});
        toggler.type = 'checkbox';

        // Style the toggler depending on start value
        if (matchedValue === 'true') {
            toggler.checked = true
            style(toggler, {backgroundColor: '#28a745', borderColor: '#28a745'});
        } else {
            toggler.checked = false
            style(toggler, {backgroundColor: '#ccc', borderColor: '#383838'});
        }

        // Append eventlistener to toggle input
        toggler.addEventListener('change', (event) => {

            // Extract the activity input
            const activity = event.target.checked;

            // Set activity dependend style
            if (activity) {
                // Switched ON
                toggler.style.backgroundColor = '#28a745'; // Bootstrap green
                toggler.style.borderColor = '#28a745';
                console.log('Enable blocklist: ' + blockListName)
            } else {
                // Switched OFF
                toggler.style.backgroundColor = '#ccc';
                toggler.style.borderColor = '#383838';
                console.log('Disable blocklist: ' + blockListName);
            }

            // Send request to server
            fetch('/state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'blocklist', type: 'activity', value: activity, name: blockListName })
            });

        });

    }, 4);


    // Add an delete/remove-button for each row
    const rows = blockListTable.querySelectorAll('tbody tr');
    var headerSkip = true;
    for (let row of rows) {

        // Skip the first header row.
        if (headerSkip) {
            headerSkip = false;
            const headerCell = document.createElement('th');
            row.appendChild(headerCell)
            continue;
        }
        
        // Retrieve corr. blocklist name
        const rowEntries    = row.querySelectorAll('td');
        let blockListName   = rowEntries[0].innerHTML;

        // Create a remove cell
        const removeCell = document.createElement('td');
        removeCell.style.cursor = 'pointer';
        row.appendChild(removeCell);
        removeCell.innerHTML = '✖️';

        // Remove cell acts as a button
        removeCell.addEventListener('click', () => {
            // Remove row from table
            row.remove();
            // Remove the blocklist from state
            fetch('/state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'blocklist', name: blockListName, type: 'remove' })
            });
        });

    }

    // Add ellipsis to all urls and names texts on overflow
    [0, 1].forEach((rowIndex) => {
        filterTableByColumn(blockListTable, rowIndex, (cell, row, col) => {
            cell.style.whiteSpace = 'nowrap';
            cell.style.overflow = 'hidden';
            cell.style.textOverflow = 'ellipsis';
        })
    })

    // Set relative column spacing 
    setRelativeColumnWidths(blockListTable, [0.3, 0.2, 0.1, 0.2, 0.1, 0.1])
    
}

/**
 * Loads the frame and initializes moving Container.
 * @returns {Promise<void>}
 */
async function loadBlocklistContainer () {
    
    // Initialize the container frame
    let container = new movingContainer('blocklist', [ 800, 500 ], "", 'Blocklists');
    autoPlaceContainer('blocklist');
    
    // Load content
    await loadBlocklistContainerContent(container);

}

// ============ Statistics Container ============
async function loadStatsContainerContent (container) {
    
    let containerBody = container.body;
    containerBody.classList.add('container');
    containerBody.innerHTML = '';

    // Request dns stats from server
    const dns = await (await fetch('/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'dns' })
    })).json();
    console.log('stats', dns);

    // -------- Total Header --------
    const totalsRow       = create('div', 'totals-row', containerBody);
    totalsRow.classList.add('row', 'no-gutters');
    const totalQueryCol   = create('div', 'totals-query-col', totalsRow);
    totalQueryCol.classList.add('col-6', 'justify-content-md-center');
    const totalBlockCol   = create('div', 'totals-block-col', totalsRow);
    totalBlockCol.classList.add('col-6', 'justify-content-md-center');

    const totalResolutions  = dns.resolutions.total_events;
    const totalBlocks       = dns.blocks.total_events;
    const totalQueries      = totalResolutions + totalBlocks;
    const blockShare        = Math.round(1000 * totalBlocks / totalQueries) / 10 || 0;
    
    // Add the total query counter content
    const totalQueryContent = create('div', 'total-query-content', totalQueryCol);
    const counterInfo       = create('h4', 'total-query-info-label', totalQueryContent);
    style(counterInfo, {color: '#228dcfff', fontWeight: 'bold'});
    counterInfo.innerHTML   = 'Total DNS Queries'
    const counterLabel      = create('h1', 'total-query-counter-label', totalQueryContent);
    style(counterLabel, {   color: '#228dcfff', 
                            fontWeight: 'bold',
                            fontSize: '4rem', 
                            width: '100%', 
                            textAlign:'center'});
    counterLabel.innerHTML  = totalQueries;

    // Add the blocks counter content
    const totalBlockContent = create('div', 'total-block-content', totalBlockCol);
    const blockInfo       = create('h4', 'total-block-info-label', totalBlockContent);
    style(blockInfo, {color: '#dc3f51ff', fontWeight: 'bold'});
    blockInfo.innerHTML   = `Blocked (${blockShare}%)`
    const blockLabel      = create('h1', 'total-block-counter-label', totalBlockContent);
    style(blockLabel, {   color: '#dc3f51ff', 
                            fontWeight: 'bold',
                            fontSize: '4rem', 
                            width: '100%', 
                            textAlign:'center'});
    blockLabel.innerHTML  = totalBlocks;

    // -------- Timeseries Chart --------
    const queryChartRow = create('div', 'query-chart-row', containerBody);
    queryChartRow.classList.add('row', 'no-gutters');
    const queryChartCol = create('div', 'query-chart-col', queryChartRow);
    queryChartCol.classList.add('col-12', 'justify-content-md-center');
    const queryChartElement = create('canvas', 'query-timeseries-chart', queryChartCol);
    queryChartRow.style.maxHeight = '30%';
    

    // Aggregate arrays of timeseries    
    let times = timesArray(24, true);
    const resolutionsArray = await aggregateTimeseriesArray(dns.resolutions.timeseries, 24);
    const blocksArray = await aggregateTimeseriesArray(dns.blocks.timeseries, 24);
    // Construct Bar Chart
    const queryChart = new Chart(queryChartElement, {
        type: 'bar',
        data: {
            labels: times,
            datasets: [{
                label: 'Resolutions',
                data: resolutionsArray,
                borderWidth: 1
            },
            {
                label: 'Blocks',
                data: blocksArray,
                borderWidth: 1
            }
        ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    ticks: {
                        display: false // 🚫 Hides all tick labels
                    }
                },
                y: {
                    ticks: {
                        display: false // 🚫 Hides all tick labels
                    }
                }
            }
        }
    });


    // -------- Top Queried Domains Table -------- 
    // Create a top query table
    const globalTableHeight = '250px'
    const tableRow = create('div', 'top-query-table-row', containerBody);
    tableRow.classList.add('row', 'no-gutters');
    const tableCol = create('div', 'top-query-table-col', tableRow);
    tableCol.classList.add('col-12', 'justify-content-md-center');
    tableCol.style.height = 'auto'
    style(tableCol, {color: 'white', width: '50%', position: 'relative', overflow: 'hidden'});
    const heading = create('h3', 'dns-table-heading', tableCol);
    heading.classList.add('stats-container-headings');
    heading.style.margin = 0;
    heading.innerHTML = 'Top Queried Domains';
    const tableWrapper = create('div', 'top-query-table-wrapper', tableCol);
    style(tableWrapper, {
        height: '200px',
        scrollbarWidth: 'none', 
        overflowY: 'auto', 
        msOverflowStyle: 'none'});
    const topQueryTable = createTableFromJSON(
            dns.top_queried_domains, 
            tableWrapper.id, 
            false, 
            'hidden', 
            true,
            false, 
            true);
    topQueryTable.classList.add('table-hover');
    style(topQueryTable, {maxHeight: globalTableHeight, color: 'white', backgroundColor: 'rgba(20,20,20,0.6)'})
    setRelativeColumnWidths(topQueryTable, [0.6, 0.2, 0.2]);


    // -------- Top Blocked Domains Table --------
    const blockTableCol = create('div', 'top-block-table-col', tableRow);
    blockTableCol.classList.add('col-12', 'justify-content-md-center');
    blockTableCol.style.height = 'auto';
    style(blockTableCol, {color: 'white', width: '50%', position: 'relative', overflow: 'hidden'});
    const bHeading = create('h3', 'block-table-heading', blockTableCol);
    bHeading.classList.add('stats-container-headings');
    bHeading.style.margin = 0;
    bHeading.innerHTML = 'Top Blocked Domains';
    const blockTableWrapper = create('div', 'top-block-table-wrapper', blockTableCol);
    style(blockTableWrapper, {
        height: '200px',
        scrollbarWidth: 'none', 
        overflowY: 'auto', 
        msOverflowStyle: 'none'});
    const topBlockTable = createTableFromJSON(
            dns.top_blocked_domains, 
            blockTableWrapper.id, 
            false, 
            'hidden', 
            true,
            false, 
            true);
    topBlockTable.classList.add('table-hover');
    style(topBlockTable, {maxHeight: globalTableHeight, backgroundColor: 'rgba(20,20,20,0.6)'})
    setRelativeColumnWidths(topBlockTable, [0.6, 0.2, 0.2]);


    // -------- Clients Share Chart --------
    const secondRow                 = create('div', 'second-row', containerBody);
    secondRow.classList.add('row', 'no-gutters');
    secondRow.style.marginTop       = '10px';
    const clientPieChartCol         = create('div', 'client-pie-chart-col', secondRow);
    clientPieChartCol.classList.add('col-12', 'justify-content-md-center');
    clientPieChartCol.style.height  = 'auto';
    style(clientPieChartCol, {color: 'white', width: '50%'});
    const clientHeading             = create('h3', 'client-pie-chart-heading', clientPieChartCol);
    clientHeading.classList.add('stats-container-headings');
    style(clientHeading, {width: '100%', color: '#ccc', textAlign: 'center', background: 'rgba(10,10,10,0.4)'});
    clientHeading.innerHTML         = 'Request By Clients';
    const clientPieChartWrapper     = create('div', 'client-pie-chart-wrapper', clientPieChartCol);
    style(clientPieChartWrapper, {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        height: '220px',
        scrollbarWidth: 'none', 
        overflowY: 'auto', 
        msOverflowStyle: 'none'});
    const clientPieChartCanvas = create('canvas', 'client-pie-chart', clientPieChartWrapper);
    style(clientPieChartCanvas, {height: '100%'});

    // Prepare data for chart
    const clientNames = Object.keys(dns.top_clients);
    const clientQueries = Object.values(dns.top_clients);
    const total = clientQueries.reduce((acc, curr) => acc + curr, 0);
    let outputs = [];
    for (let queries of clientQueries) {
        const share = Math.round( 1000 * queries / total ) / 10;
        outputs.push(`${queries} (${share}%)`);
    }
    const pieChartColors    = [
        '#2A86BF',
        '#2a9fbfff',
        '#2ababfff',
        '#2abf7cff',
        '#2abf48ff',
        '#4fbf2aff',
        '#6dbf2aff',
        '#499835ff',
        '#359856ff',
        '#4266d3ff'
    ];  
    const clientPieChart = new Chart(clientPieChartCanvas, {
        type: 'doughnut',
        data: {
            labels: clientNames,
            datasets: [
                {
                    label: 'Queries',
                    data: clientQueries,
                    borderWidth: 1,
                    backgroundColor: pieChartColors,
                    hoverBackgroundColor: pieChartColors
                },
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                datalabels: {
                    color: '#fff',
                    formatter: (queries, context) => {
                        // const label = context.chart.data.labels[context.dataIndex];
                        return `${context.chart.data.labels[context.dataIndex]} (${Math.round( 1000 * queries / total ) / 10}%)`;
                    },
                    font: {
                        weight: 'bold',
                        size: 12
                    }
                },
                legend: {
                    display: false // 👈 This removes the legend!
                }
            }
        },
        plugins: [ChartDataLabels] // ✅ Plugin applied only to this chart
    });

    // -------- Log search utility --------
    const logTableCol            = create('div', 'log-table-col', secondRow);
    logTableCol.classList.add('col-12', 'justify-content-md-center');
    logTableCol.style.height     = 'auto';
    style(logTableCol, {color: 'white', width: '50%'});
    const logHeading             = create('h3', 'log-section-heading', logTableCol);
    logHeading.classList.add('stats-container-headings');
    style(logHeading, {width: '100%', color: '#ccc', textAlign: 'center', background: 'rgba(10,10,10,0.4)'});
    logHeading.innerHTML      = 'Source Logs';

    // Build a wrapper container for structuring
    const logWrapper = create('div', 'log-section-wrapper', logTableCol);
    logWrapper.classList.add('container', 'p-0');

    // Add a search utility row
    const searchUtilityRow = create('div', 'log-search-row', logWrapper);
    searchUtilityRow.classList.add('row', 'no-gutters');
    const searchInputCol   = create('div', 'log-search-input-col', searchUtilityRow);
    searchInputCol.classList.add('col-12');
    const searchInput      = create('input', 'log-search-input', searchInputCol);
    style(searchInput, {width: '100%'});
    searchInput.placeholder = 'source logs ...';
    searchInput.classList.add('bg-dark-medium');
    
    // Prepare a table row where to place the table later
    const logTableRow = create('div', 'log-section-log-table-row', logWrapper);
    logTableRow.classList.add('row', 'no-gutters');
    const logTableWrapper     = create('div', 'log-section-log-table-wrapper', logTableRow);
    style(logTableWrapper, {
        height: '220px', 
        width: '100%',
        scrollbarWidth: 'none', 
        overflowY: 'auto', 
        msOverflowStyle: 'none'});
    
    

    async function searchLogs () {
        if (searchInput.value && searchInput.value.length >= 3 || searchInput.value.length == 0) {
            // Prepare data for logs table
            const data = await (await fetch('/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ searchInput: searchInput.value })
            })).json();
            // Create and inject table
            logTableWrapper.innerHTML = '';
            const table = await createTableFromJSON(data.logs, 'log-section-log-table-wrapper', true, 'hidden', true, false, true);
            // Align column widths
            setRelativeColumnWidths(table, [0.3, 0.7]);
            // Color blocked domains
            filterTableByValues(table, ['blocked'], (cell, value, row) => {
                row.setAttribute("style", "background-color: #dc3f51ff !important;");
                row.setAttribute("style", "--bs-table-bg: #9a404bff !important;");
            });
            // filterTableByValues(table, [''], (cell, value, row) => {
            //     if (value.includes('blocked'))
            //         row.style.backgroundColor = '#dc3f51ff !important' --bs-table-bg
            // })
        }
    }

    // Add a search algorithm to the search input element 
    searchInput.addEventListener('input', async () => {
        searchLogs()
    });
    searchLogs(); // Call once at init



    // -------- DNS resolve utility (good for testing) --------
    const dnsResolveRow = create('div', 'dns-resolve-row', containerBody);
    dnsResolveRow.classList.add('row', 'no-gutters');
    const dnsInputCol = create('div', 'dns-resolve-row', dnsResolveRow);
    dnsInputCol.classList.add('col-4', 'justify-content-md-center');
    const dnsInput = create('input', 'dns-input', dnsInputCol);
    style(dnsInput, {width: '100%', height: '100%'});
    dnsInput.placeholder = 'url to resolve ...';

    const dnsButtonCol = create('div', 'dns-resolve-row', dnsResolveRow);
    dnsButtonCol.classList.add('col-2', 'justify-content-md-center');
    const dnsButton = create('button', 'dns-input', dnsButtonCol);
    dnsButton.classList.add('rounded-button');
    dnsButton.innerHTML = 'resolve';

    const dnsLabelCol = create('div', 'dns-resolve-row', dnsResolveRow);
    dnsLabelCol.classList.add('col-4');
    const dnsLabel = create('label', 'dns-resolve-output', dnsLabelCol);
    dnsLabel.style.color = 'white';

    dnsButton.addEventListener('click', async () => {
        const url      = dnsInput.value;
        // Make a dns request to resolve endpoint
        const response = await fetch('/resolve?url='+url);
        const data     = await response.text();
        // Display url in label
        dnsLabel.innerHTML = data;
    });

}

async function loadStatsContainer () {
    
    // Initialize the container frame
    let container = new movingContainer('statistics', [ 800, 950 ], "", 'DNS Statistics');
    autoPlaceContainer('statistics');

    await loadStatsContainerContent(container);

}

// ============ Clock Widget Container ============
async function loadClockContainer () {

    const clockSizeInPx = 300;  
    
    // Initialize the container frame
    let container = new movingContainer('clock', [ clockSizeInPx, clockSizeInPx ], "", "", true);
    container.header.remove(); // remove header
    container.body.style.padding = '0';
    container.element.style.backgroundColor = 'rgba(0,0,0,0)'
    autoPlaceContainer('clock');

    await loadClassicClock(container, clockSizeInPx);

}

async function loadClassicClock (container, clockSizeInPx) {

    let containerBody = container.body;
    containerBody.classList.add('container');
    containerBody.innerHTML = '';
    container.element.style.overflow = 'hidden';

    const clockWrapper = create('div', 'classic-clock-wrapper', containerBody);
    style(clockWrapper, {width: `${clockSizeInPx}px`, height: `${clockSizeInPx}px`, zIndex: '998'})

    // Create canvas and context
    const canvas = create('canvas', 'classic-clock-frame', clockWrapper);
    const ctx = canvas.getContext('2d');

    // Set the desired size (e.g., 300x300 for 1:1 ratio)
    canvas.width = clockSizeInPx;
    canvas.height = clockSizeInPx;

    // Optional: Add styles to match the attributes
    style(canvas, {width: '100%', height: 'auto', aspectRatio: `1 / 1`})

    // Set background color
    ctx.fillStyle = '#111'; // Set the fill color
    ctx.fillRect(0, 0, canvas.width, canvas.height); // Fill the entire canvas


    // Create clock dial
    const a    = canvas.width; // square side
    const R    = a / 2;
    const center = [Math.round(canvas.width / 2), Math.round(canvas.height / 2)];

    // Create Center
    const dialColor = 'white';
    ctx.beginPath();
    ctx.arc(center[0], center[1], 6, 0, 2 * Math.PI);
    ctx.fillStyle = dialColor;
    ctx.fill();

    // Create dial ticks
    for (let angle=0; angle<360; angle=angle+6) {

        // Convert angle to radians
        const rad = 2 * Math.PI * angle / 360;

        // Define radial unit vector and multiply by the heading to 
        // aim at the starting point of rendering
        const x = Math.cos(rad), 
              y = Math.sin(rad); 
        
        // Define the limit for the magnitude of r i.e. when it touches the outside square.
        let rLim;
        if (Math.abs(x) < Math.abs(y)) {
            const ySign = Math.sign(y);
            rLim = [a*x/(2*y)*ySign, a/2*ySign];
        } else if (Math.abs(y) < Math.abs(x)) {
            const xSign = Math.sign(x);
            rLim = [a/2*xSign, a*y/(2*x)*xSign];
        } else {
            let rMax = a / Math.sqrt(2);
            rLim = [rMax, rMax]
        }

        // Define start
        var dialPadding;
        if (angle % 90 == 0) {
            dialPadding   = 0.7;
            ctx.lineWidth = 7;
        } else if (angle % 5 == 0) {
            dialPadding = 0.8;
            ctx.lineWidth = 5;
        } else {
            dialPadding = 0.9;
            ctx.lineWidth = 3;
        }
        var r0   = [ dialPadding * rLim[0], dialPadding * rLim[1] ];

        // Shift to origin
        r0 = [center[0] + r0[0], center[1] + r0[1]];
        rLim = [center[0] + 1.1*rLim[0], center[1] + 1.1*rLim[1]];

        // Based on the r limit define the limit vector point
        ctx.strokeStyle = dialColor;
        ctx.beginPath();
        ctx.moveTo(...r0);
        ctx.lineTo(...rLim);
        ctx.stroke();

    }

    // Finalize dial as image snapshot
    const dial = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Create handle render function which can be called continuously
    async function renderTime () {
        const d = new Date();
        const h = d.getHours();
        const m = d.getMinutes();
        const s = d.getSeconds();
        const ms = d.getMilliseconds();

        // Create hour handle
        const hourScale = 0.6;
        const hourAngle = ((h + m / 60 + s / 3600) / 12) * 2 * Math.PI - Math.PI/2;
        const rHour     = [center[0] + hourScale * R * Math.cos(hourAngle), center[1] + hourScale * R * Math.sin(hourAngle)];
        ctx.lineWidth   = 10;
        ctx.beginPath();
        ctx.moveTo(...center);
        ctx.lineTo(...rHour);
        ctx.stroke();

        // Create minute handle
        const minScale  = 0.8;
        ctx.lineWidth   = 8;
        const minAngle  = (m + s/60) / 60 * 2 * Math.PI - Math.PI/2; 
        const rMin      = [center[0] + minScale * R * Math.cos(minAngle), center[1] + minScale * R * Math.sin(minAngle)];
        ctx.beginPath();
        ctx.moveTo(...center);
        ctx.lineTo(...rMin);
        ctx.stroke();

        // Create second handle
        const secScale  = 0.8;
        ctx.lineWidth   = 2;
        ctx.strokeStyle = '#ce1212ff';
        const secAngle  = (s+ms/1000)/60 * 2 * Math.PI - Math.PI/2; 
        const rSec      = [center[0] + secScale * R * Math.cos(secAngle), center[1] + secScale * R * Math.sin(secAngle)];
        ctx.beginPath();
        ctx.moveTo(...center);
        ctx.lineTo(...rSec);
        ctx.stroke();
        ctx.strokeStyle = 'white';
        const dialColor = '#891b1bff';
        ctx.beginPath();
        ctx.arc(center[0], center[1], 4, 0, 2 * Math.PI);
        ctx.fillStyle = dialColor;
        ctx.fill();
        ctx.fillStyle = 'white';

    } 

    async function ticTac () {
        while (true) {
            try {
                ctx.putImageData(dial, 0, 0);
                await renderTime()
            } catch (error) {
                console.error('[clock widget]', error)
            } finally {
                await sleep(20);
            }
        }
    }

    // Start the clock asynchronously
    ticTac();

}


export async function dashPage (params) {
    
    const app = document.getElementById('app');

    // Clear the app container
    app.innerHTML = '';

    // Add the dashboard page to the app container
    const page = create('div', 'page-dashboard', 'app');

    // Run init tasks
    await loadState();
    loadBackground(page);
    loadNavigation();
    loadBlocklistContainer();
    loadStatsContainer();
    loadClockContainer();

    // Run a session timeout (on inactivity the server will remove the authentication status)
    sessionTimeoutLoop(5);
}