import { state } from './state.js';
import { sleep, shakeIt } from './ani.js';


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
 * Tries to authenticate the payload at auth endpoint. Returns a boolean based on success.
 * @param {string} payload - The payload for authentication i. e. password.
 * @returns {boolean} - Returns a boolean.
 */
export async function authenticate (payload) {
    /* Checks if the password payload matches the server hash. */
    try {
        // fetch the result from API
        console.log('payload', payload)
        const res = await fetch('/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: payload })
        });
        const result = await res.json();
        console.log(result.msg); // Show response message
        return result.status;
    } catch (error) {
        console.error('Error communicating with /auth endpoint:', error);
        return false
    }
}


/**
 * Tries to authenticate the payload at auth endpoint. Returns a boolean based on success.
 * @param {number} delayInMs Loop delay in seconds.
 * @returns {Promise<void>}
 */
export async function sessionTimeoutLoop (delayInS) {
    while (true) {
        try {
            // Skip the request if the state is not authenticated.
            if (state.authenticated) {
                // Check if session is still active
                const check = await isAuthenticated();
                console.log('sessionTimeout', check)
                if (!check) {
                    location.reload(true); // Deprecated but used to bypass cache in some browsers
                }
            }
        } catch (error) {
            console.error('[sessionTimeoutLoop]', error)
        } finally {
            await sleep(delayInS)
        }
    }
}



/**
 * Checks if authentication is still active. Returns boolean on success.
 * @returns {boolean} - Returns a boolean.
 */
export async function isAuthenticated () {
    try {
        // fetch the result from API
        const res = await fetch('/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ "check": true})
        });
        return (await res.json()).status;
    } catch (error) {
        console.error('Error communicating with /auth endpoint:', error);
        return false
    }
}



/**
 * Checks if a signup happened already. Otherwise will have to set a password.
 * @returns {HTMLElement} - Returns a boolean.
 */
export async function credentialsAreSet () {
    try {
        // fetch the result from API
        const res = await fetch('/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ "signup": true })
        });
        const status = (await res.json()).status;
        console.log("credentials exist:", status);
        return status;
    } catch (error) {
        console.error('Error communicating with /auth endpoint:', error);
        return false
    }
}



/**
 * Final authentication page. The process is blocking and preventing the page to continue, 
 * as API endpoints remain unresponsive until successful authentication. 
 */
export async function authPage () {

    // Check if session is still authenticated.
    if (await isAuthenticated()) {
        state.authenticated = true;
        console.log('login still active.');
        return
    }

    console.log('try to authenticate ... ');
    
    // purge everything in the app
    document.getElementById('app').innerHTML = '';

    // Create a page for authentication
    let page = create('span', 'page-auth', 'app');
    
    // Container for the authentication
    let container = create('div', 'container-auth', 'page-auth');
    container.classList.add('center-content-hv-col', 'rounded', 'contour', 'drop-shadow', 'bg-dark-medium');
    container.style.height = '50%';
    container.style.width = '50%';
    container.style.marginLeft = '25vw';
    container.style.marginTop = '25vh';
    container.style.padding = '100px';

    let welcomeHeader = create('h1', 'txt-lbl-welcome', 'container-auth');
    welcomeHeader.innerText = `Welcome to ${document.title}!`; // Set welcome text
    welcomeHeader.style.width = '100%';
    welcomeHeader.style.textAlign = 'center';
    welcomeHeader.style.verticalAlign = 'middle';
    
    // Create a little form for the password
    let form = create('form', 'form-auth', 'container-auth');
    form.classList.add('center-content-hv-col');
    form.style.height = '20%';

    // Create input field for credentials
    let inputField = create('input', 'txt-input-auth', 'form-auth');
    inputField.placeholder = 'password';
    inputField.setAttribute('type', 'password');
    inputField.style.minWidth = '100px';
    inputField.style.width = '80%';
    inputField.style.marginLeft = '10%';
    inputField.style.textAlign = 'center';

    // Check first if the creds are set and if signup is needed.
    let credsAreSet = await credentialsAreSet();
    if (!credsAreSet) {
        let repeatField = create('input', 'txt-input-auth-repeat', 'form-auth');
        repeatField.placeholder = 'repeat password';
        repeatField.setAttribute('type', 'password');
        repeatField.style.minWidth = '100px';
        repeatField.style.width = '80%';
        repeatField.style.marginLeft = '10%';
        repeatField.style.textAlign = 'center';
    }
    
    // Create submit button
    let submitButton = create('button', 'button-auth-submit', 'form-auth');
    submitButton.classList.add('rounded');
    if (!credsAreSet)
        submitButton.innerHTML = 'set password';
    else
        submitButton.innerHTML = 'login';
    submitButton.style.direction = 'none';
    submitButton.style.width = '80%';
    submitButton.style.marginLeft = '10%';
    submitButton.setAttribute('type', 'submit');

    // Define the submit button action
    submitButton.addEventListener('click', async (event) => {
        // If the button is inside a <form>, the browser automatically tries 
        // to submit the form and reload the page unless it is explicitly prevented.
        // Prevent the form from submitting normally
        event.preventDefault(); 
        // Get the input field for the password.
        const inputField = document.getElementById('txt-input-auth');
        // Check if the form should serve as a sign-up page
        if (credsAreSet == false) {
            // Add a repeat field.
            const repeatField = document.getElementById('txt-input-auth-repeat');
            // Check if the passwords match ...
            if (repeatField.value != inputField.value) {
                // Clear all inputs
                inputField.value = '';
                repeatField.value = '';
                // Signal wrong answer to end-user
                container.classList.remove('contour');
                container.classList.add('contour-red');
                // Shake container
                shakeIt(container, .1, 0.01, 10, 2);
                inputField.placeholder  = 'dont match!';
                repeatField.placeholder = 'dont match!';
                await sleep(5);
                container.classList.remove('contour-red');
                container.classList.add('contour');
                inputField.placeholder = 'password';
                repeatField.placeholder = 'repeat password';
                return
            }
            // from here continue with normal authentication process.
        }
        // Authenticate with provided password.
        const password = inputField.value;
        inputField.value = '';
        const authenticated = await authenticate(password);
        if (authenticated) 
            state.authenticated = true;
        else {
            // Signal wrong answer to end-user
            container.classList.remove('contour');
            container.classList.add('contour-red');
            // Shake container
            shakeIt(container, .1, 0.01, 10, 2);
        }
        return
    });

    // Block until authentication
    while (!state.authenticated)
        await new Promise(r => setTimeout(r, 100));
    

    // Wait a second to welcome a new user
    // Notify complete signup.
    if (!credsAreSet) {
        form.remove();
        welcomeHeader.innerText = 'Successfully signed up!';
        await sleep(3);
    }

}