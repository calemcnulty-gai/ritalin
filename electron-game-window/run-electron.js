#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Try to find electron in various locations
const possiblePaths = [
    // On macOS, the actual binary is in the .app bundle
    path.join(__dirname, 'node_modules', 'electron', 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron'),
    // On Windows
    path.join(__dirname, 'node_modules', 'electron', 'dist', 'electron.exe'),
    // On Linux
    path.join(__dirname, 'node_modules', 'electron', 'dist', 'electron'),
    // Fallback to .bin (might be a symlink)
    path.join(__dirname, 'node_modules', '.bin', 'electron'),
];

let electronPath = null;
for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
        electronPath = p;
        break;
    }
}

if (!electronPath) {
    // console.error('Electron not found. Installing...');
    // Install electron locally
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const install = spawn(npm, ['install', 'electron@27', '--no-save'], {
        cwd: __dirname,
        stdio: 'inherit'
    });
    
    install.on('close', (code) => {
        if (code !== 0) {
            console.error('Failed to install Electron');
            process.exit(1);
        }
        
        // Try to find electron again
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                electronPath = p;
                break;
            }
        }
        
        if (!electronPath) {
            console.error('Still cannot find Electron after installation');
            process.exit(1);
        }
        
        runElectron(electronPath);
    });
} else {
    runElectron(electronPath);
}

function runElectron(electronPath) {
    console.log('Starting Electron from:', electronPath);
    console.log('Current directory:', __dirname);
    console.log('Process arguments:', process.argv);
    // Pass '.' to run the current directory (which has package.json pointing to main.js)
    // Electron expects the path to the app directory or main.js file
    const mainPath = path.join(__dirname, 'main.js');
    console.log('Launching Electron with main.js:', mainPath);
    
    const electron = spawn(electronPath, [mainPath], {
        stdio: 'pipe',  // Use pipe to allow IPC communication
        cwd: __dirname
    });
    
    // Forward stdout and stderr to parent process
    electron.stdout.on('data', (data) => {
        process.stdout.write(data);
    });
    
    electron.stderr.on('data', (data) => {
        process.stderr.write(data);
    });
    
    // Forward stdin from parent to electron
    process.stdin.on('data', (data) => {
        electron.stdin.write(data);
    });
    
    electron.on('close', (code) => {
        process.exit(code);
    });
} 