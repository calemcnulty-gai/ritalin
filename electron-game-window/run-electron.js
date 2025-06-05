#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

// Try multiple strategies to find electron
function findElectron() {
    // Strategy 1: Try local node_modules
    try {
        const localElectron = require('./node_modules/electron');
        if (fs.existsSync(localElectron)) {
            console.log('Found electron in local node_modules:', localElectron);
            return localElectron;
        }
    } catch (e) {
        // Not found locally
    }
    
    // Strategy 2: Try parent directory node_modules (for packaged extension)
    try {
        const parentElectron = require('../node_modules/electron');
        if (fs.existsSync(parentElectron)) {
            console.log('Found electron in parent node_modules:', parentElectron);
            return parentElectron;
        }
    } catch (e) {
        // Not found in parent
    }
    
    // Strategy 3: Try to find electron in the extension's root
    try {
        const extensionRoot = path.resolve(__dirname, '..');
        const electronPath = path.join(extensionRoot, 'node_modules', 'electron', 'index.js');
        if (fs.existsSync(electronPath)) {
            const electron = require(electronPath);
            console.log('Found electron via extension root:', electron);
            return electron;
        }
    } catch (e) {
        // Not found
    }
    
    // Strategy 4: Use electron from PATH (if globally installed)
    const electronCommand = process.platform === 'win32' ? 'electron.cmd' : 'electron';
    try {
        const which = require('child_process').execSync(`which ${electronCommand}`, { encoding: 'utf8' }).trim();
        if (which) {
            console.log('Found electron in PATH:', which);
            return which;
        }
    } catch (e) {
        // Not in PATH
    }
    
    throw new Error('Could not find Electron. Please ensure electron is installed.');
}

const electron = findElectron();

console.log('Electron path resolved to:', electron);

function runElectron() {
    console.log('Starting Electron from:', electron);
    console.log('Current directory:', __dirname);
    
    // Match the official electron wrapper's approach but with our modifications
    const args = ['.'];  // Run with current directory
    
    console.log('Spawning Electron with args:', args);
    
    // Create a temporary file for IPC since we can't use stdin with 'inherit'
    const ipcPath = path.join(__dirname, '.ipc-messages');
    
    // Use stdio: 'inherit' like the official wrapper
    // This ensures Electron gets the proper terminal context
    const electronProcess = spawn(electron, args, {
        cwd: __dirname,
        stdio: 'inherit',
        windowsHide: false,
        env: {
            ...process.env,
            // Ensure Electron runs in app mode
            ELECTRON_RUN_AS_NODE: undefined,
            // Pass IPC file path to Electron
            RITALIN_IPC_PATH: ipcPath
        }
    });
    
    // Set up stdin reader to forward messages via file
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    });
    
    rl.on('line', (line) => {
        // Write message to IPC file for Electron to read
        fs.appendFileSync(ipcPath, line + '\n');
    });
    
    electronProcess.on('close', function (code, signal) {
        // Clean up IPC file
        try {
            fs.unlinkSync(ipcPath);
        } catch (e) {
            // Ignore if already deleted
        }
        
        if (code === null) {
            console.error(electron, 'exited with signal', signal);
            process.exit(1);
        }
        process.exit(code);
    });
    
    // Handle termination signals
    const handleTerminationSignal = function (signal) {
        process.on(signal, function signalHandler () {
            if (!electronProcess.killed) {
                electronProcess.kill(signal);
            }
        });
    };
    
    handleTerminationSignal('SIGINT');
    handleTerminationSignal('SIGTERM');
}

// Run Electron
runElectron(); 