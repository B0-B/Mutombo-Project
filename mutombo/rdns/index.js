// const fs = require('fs');
// const path = require('path');
// const { spawn } = require('child_process');
// const sqlite3 = require('sqlite3').verbose();

import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { spawn } from 'child_process';
import sqlite3 from 'sqlite3';
import { log, sleep } from '#utils';


const { verbose } = sqlite3;
const sqlite3Verbose = verbose();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



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
 * Recursive DNS service.
 */
export class RDNS {

  constructor (logPath) {

    // Regex patterns.
    this.urlPattern = /^[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]*$/;
    this.ipv4Pattern = /\b(\d{1,3}\.){3}\d{1,3}\b/;
    this.ipv6Pattern = /\b(?:[a-fA-F0-9]{1,4}:){1,7}[a-fA-F0-9]{1,4}\b/;

    this.logPath = logPath;
    this.logFile = path.join(this.logPath, 'rdns.log');

    // Initialize sqlite3 database.
    this.initDatabase();

  }

  /**
    * Initialize database and table.
    * If no database exists it will be created from scratch including all tables.
    */
  async initDatabase () {
    
    // Resolve the database path
    this.databasePath = path.resolve(__dirname, 'domains.db');
    
    console.log('db path', this.databasePath);
    let initTables = false;
    if (!fs.existsSync(this.databasePath))
        initTables = true

    // Open database in read write mode.
    this.db = new sqlite3Verbose.Database(this.databasePath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE);

    // Initialize tables.
    if (initTables) {
        await this.send(
            `CREATE TABLE IF NOT EXISTS domains (
                id INTEGER PRIMARY KEY,
                domain TEXT NOT NULL,
                ipv4_list TEXT NOT NULL,
                ipv6_list TEXT NOT NULL,
                count INTEGER UNSIGNED
            )`
        );
        await this.send(
            `CREATE TABLE IF NOT EXISTS ips (
                id INTEGER PRIMARY KEY,
                ip TEXT NOT NULL,
                domain TEXT NOT NULL
            )`
        );
    }
    
  }

  /**
    * Raw sql execution using sqlite3.exec to send commands to the database.
    * @param {string} sql - sql command
    * @returns {Promise<void>} List of matching rows.
    */
  async send (sql) {
    return new Promise((resolve, reject) => {
        this.db.exec(sql, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
  }

  /**
    * Raw sql execution using sqlite3.all to fetch the SQL stdout.
    * @param {string} sql - sql command
    * @returns {Array<string>} List of matching rows.
    */
  async get (sql) {
    return new Promise((resolve, reject) => {
        this.db.all(sql, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
  }

  /**
    * An upstream-free domain name lookup routine which involves
    * - SQL database lookup (for quick retrieval)
    * - If the db lookup fails this will try to resolve via root and tld servers
    * - Once resolved the data will be fed back into the database.
    * If the domain cannot be resolved an error will be thrown.
    * @param {string} domain - domain name to resolve.
    * @returns {string} IP address as string.
    */
  async lookup (domain) {

    if (!domain)
        throw Error('[ERROR] No domain defined!')

    // Request entries from database
    const dbResults = await this.get(`SELECT id, domain, ipv4_list, ipv6_list, count 
                                      FROM domains 
                                      WHERE domain='${domain}'`);
    
    var id, count;
    var empty_ip_list = false;

    // Stop here if the database results yielded something
    if (dbResults.length > 0) {

        // Unpack the query 
        id    = dbResults[0]['id'];
        count = dbResults[0]['count'];
        console.log('debug', dbResults)
        const parsedIPv4List = JSON.parse( dbResults[0]['ipv4_list'] )
        const parsedIPv6List = JSON.parse( dbResults[0]['ipv6_list'] )

        // Concatenate to a single list of IPs
        const parsedIPList = [...parsedIPv4List, ...parsedIPv6List];
        console.log('parsed ip list', parsedIPList)
        
        // Check if the parsedList is an empty object or empty array. 
        // This its not accidentally treating an array as an object in the 
        // second branch — which typeof would otherwise allow.
        if ((Array.isArray(parsedIPList) && parsedIPList.length === 0) || 
            (parsedIPList && typeof parsedIPList === 'object' && 
            !Array.isArray(parsedIPList) && Object.keys(parsedIPList).length === 0)) {
            empty_ip_list = true;
        } else {
            // Update the request count in database.
            const updatedCount = count + 1;
            await this.send(`UPDATE domains
                            SET count=${updatedCount}
                            WHERE id=${id};`)
            console.log('return')
            // Here the IP was found in db and can be returned directly.
            return parsedIPList[0]
        }
    } 

    // Perform recursive lookup via root servers.
    const rootQuery = await rootLookup(domain);
    const ipList = [...rootQuery['ipv4'], ...rootQuery['ipv6']];
    console.log('root ip list', ipList);
    if (ipList.length === 0)
        throw Error('Cannot resolve domain:' + domain)
    const ipv4ListStringified = JSON.stringify(rootQuery['ipv4']);
    const ipv6ListStringified = JSON.stringify(rootQuery['ipv6']);

    // Feedback the result to database with new row entry.
    if (empty_ip_list) {
        // if the ip list is empty it usually means the row 
        // exist with an id, so just override it to fix it.
        await this.send(
            `UPDATE domains
            SET ipv4_list='${ipv4ListStringified}', ipv6_list='${ipv6ListStringified}'
            WHERE id=${id};`
        )
    } else {
        await this.send(
            `INSERT INTO domains (domain, ipv4_list, ipv6_list, count) 
            VALUES ('${domain}', '${ipv4ListStringified}', '${ipv6ListStringified}', 1);`
        )
    }

    return ipList[0]

  }

  

  /**
    * Equivalent to RDNS.lookup but with secure production-ready validation, logging etc.
    * @param {string} domain - domain name to resolve.
    * @returns {Promise<string>} IP address as string, or null address i.e. '0.0.0.0' if cannot be resolved.
    */
  async resolve (domain) {
  
    // Try to resolve the domain via RDNS
    try {
        // Resolve the domain securely
        const ip = await this.lookup(domain);
        log(this.logFile, `Resolved query "${domain}"`);
        return ip
    } catch (err) {
        console.error(err);
        log(this.logFile, `Failed to resolve "${domain}"`);
        return '0.0.0.0'
    }
  
  }

  /**
    * Performs a recursive DNS lookup via root servers and returns a list of resolved IPs.
    * @param {string} domain - domain name e.g. google.com, not google.com/
    * @returns {Promise<object>} Object with two lists for IPv4 and IPv6 addresses.
    */
  async rootLookup (domain) {
      // Trace back the domain via root server using dig.
      const stdout = await system('dig', ['+trace', domain]);
      // Convert the stdout to lines.
      const lines = stdout.split('\r\n');
      // Parse out the list of resolved IPs.
      const ipv4List = [];
      const ipv6List = [];
      // Filter all lines which hold records.
      const records = lines.filter(line => !line.includes(';;'));
      // Parse out the IPs of all matches
      for (let record of records) {
          if (this.ipv4Pattern.test(record)) 
              ipv4List.push( record.match(this.ipv4Pattern)[0] )
          else if (this.ipv6Pattern.test(record))
              ipv6List.push( record.match(this.ipv6Pattern)[0] );
      }
      // Return a list of IPs
      return {
          ipv4: ipv4List,
          ipv6: ipv6List
      }
  }

  /**
    * Resets all the counts i.e. sets the 
    * count column in domain table to zero.
    */
  async resetCounts () {
    await this.send(
        `UPDATE domains
         SET count=0;`
    )
  }
}

// (async () => {
//     const r = new RDNS();
//     r.resolve('example.com')
// })()