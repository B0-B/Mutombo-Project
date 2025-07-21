<h1 align=center>Mutombo Project</h1>
<h3 align=center>No Unwanted Services In My House!</h3>
<p align=center><img src="notinmyhouse.gif" scale=2.0></p>

# Definitions 

### DNS Server
Caches and stores IPs associated to a domain name.

### Reverse DNS Server
Works like a DNS but returns a domain name for a provided IP, i. e. reverses the mapping of the DNS function.



# Development
## Software Design Requirements

- Lightweight codebase suitable for most single board systems.
- App should have a persistent desktop-like feeling.
- Use vanilla Node.js 
  - Node.js is compact and portable where the projects become portable, OS independent and easy to update and maintain  
  - Reduce codebase by excluding large frameworks like vite, react, angular etc.
  - P
  - Lean logging can shave milliseconds off request handling, especially when your service gets busy. A simple .log file gives you speed, clarity, and no external dependencies.
- Adguard as base adblocker.
- Easy usage via config.json (yaml requires a larger codebase + JSON is natively supported by node.js)


## v1.0.0 Features

1. Changeable background which scales with window size.
2. Modular and programable Widgets
   - time widget
   - notes widget
   - etc. 
3. Private Reverse DNS
4. Private DNS