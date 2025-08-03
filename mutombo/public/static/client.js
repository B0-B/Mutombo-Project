/** Mutombo - Main Server Code **/

import { state } from './state.js';
import { authPage } from './auth.js';
import { dashPage } from './dashboard.js';

async function __main__ () {

    // DNS Resolve test
    // let url = 'youtube.local';
    // const response = await fetch('/resolve?url='+url);
    // const data = await response.text();
    // console.log('TEST RDNS:', data);

    // Set title of document.
    document.title = "Mutombo";

    // Authenticate - blocks until authentication
    await authPage();
    

    // load dashboard
    console.log('load dashboard ...');
    await dashPage();

}

// Run main algorithm once the page has loaded.
document.addEventListener('DOMContentLoaded', __main__);