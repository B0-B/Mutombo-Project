/** Mutombo - Main Server Code **/

import { state } from './state.js';
import { authPage } from './auth.js';
import { dashPage } from './dashboard.js';

var app = document.getElementById('app');

async function __main__ () {

    document.title = "Mutombo";

    // authenticate - block until authentication
    await authPage();
    

    // load dashboard
    console.log('load dashboard ...');
    await dashPage();

}

// Run main algorithm once the page has loaded.
document.addEventListener('DOMContentLoaded', __main__);