const path = require('path');

// Set the working directory to the standalone directory
const standalonePath = path.join(__dirname, '.next', 'standalone');
process.chdir(standalonePath);

// Now load the standalone server from the new working directory
require(path.join(standalonePath, 'server.js'));
