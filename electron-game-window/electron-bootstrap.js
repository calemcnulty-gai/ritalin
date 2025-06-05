// This bootstrap script is designed to be run by Electron
// It sets up the environment and then loads the actual main.js

console.log('=== ELECTRON BOOTSTRAP ===');
console.log('Process type:', process.type);
console.log('Electron version:', process.versions.electron);

// At this point, we're definitely in Electron context
// So require('electron') should work properly

// Load and run the main application
require('./main.js'); 