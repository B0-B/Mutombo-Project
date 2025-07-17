import { spawn } from 'node:child_process';

/**
 * Performs a system call and returns the stdout.
 * @param {string} command - perform the command e.g. 'curl'
 * @param {ArrayLike<string>} args - list of string arguments to append to command.
 * @returns {Promise<void>}
 */
function system (command, args) {
    return new Promise((resolve, reject) => {
        const childProcess = spawn(command, args);
        let result = '';
        childProcess.stdout.on('data', data => {
            result += data.toString();
        });
        childProcess.stderr.on('data', error => {
            reject(error.toString());
        });
        childProcess.on('close', code => {
            resolve(result);
        });
    });
}


/**
 * Performs a recursive DNS lookup via root servers and returns a list of resolved IPs.
 * @param {string} domain - domain name e.g. google.com, not google.com/
 * @returns {Array<string>} List of IPv4 addresses.
 */
async function rootLookup (domain) {
    // Trace back the domain via root server using dig.
    const stdout = await system('dig', ['+trace', domain]);
    // Convert the stdout to lines.
    const lines = stdout.split('\r\n');
    // Parse out the list of resolved IPs.
    const ipList = []
    const ipv4Pattern = /\b(\d{1,3}\.){3}\d{1,3}\b/;
    // Filter all lines from dig stdout which include IPv4 patterns and indicate results.
    const matches = lines.filter(line => ipv4Pattern.test(line) && !line.includes(';;'));
    // Parse out the IPs of all matches
    for (let line of matches) {
        const ip = line.match(ipv4Pattern)[0];
        ipList.push(ip)
    }
    // Return a list of IPs
    return ipList
}


/**
 * Recursive DNS server.
 */
export class RDNS {
  constructor() {
    
  }
}

(async () => {
    rootLookup('youtube.com');
})()
