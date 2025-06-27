const { app, BrowserWindow, ipcMain, screen, globalShortcut, session, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

// Built-in MIME type mapping (no external dependencies)
const mimeTypes = {
  '.html': 'text/html',
  '.htm': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.data': 'application/octet-stream',
  '.unity3d': 'application/octet-stream',
  '.framework': 'application/octet-stream',
  '.loader': 'application/octet-stream',
  '.mem': 'application/octet-stream',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  // Special handling for compressed files
  if (ext === '.gz') {
    // Check the file extension before .gz
    const baseName = path.basename(filePath, '.gz');
    const baseExt = path.extname(baseName).toLowerCase();
    
    // For .wasm.gz files, return application/wasm with gzip encoding
    if (baseExt === '.wasm') {
      return 'application/wasm';
    }
    // For .js.gz files, return application/javascript
    if (baseExt === '.js') {
      return 'application/javascript';
    }
    // For other .gz files, return gzip
    return 'application/gzip';
  }
  
  return mimeTypes[ext] || 'application/octet-stream';
}

// Global exception handlers to prevent hanging on EPIPE errors
process.on('uncaughtException', (error) => {
  if (error.code === 'EPIPE' || error.errno === -32) {
    // EPIPE error - parent process died, exit gracefully
    console.error('EPIPE error detected - parent process died, exiting...');
    process.exit(0);
  } else {
    // Log other uncaught exceptions but still exit to prevent hanging
    console.error('Uncaught exception:', error);
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  // Don't exit for unhandled rejections unless they're EPIPE related
  if (reason && (reason.code === 'EPIPE' || reason.errno === -32)) {
    console.error('EPIPE-related promise rejection - parent process died, exiting...');
    process.exit(0);
  }
});

// Track if we suspect the parent process is dead to avoid further logging attempts
let parentProcessDead = false;

// Safe logging functions to prevent EPIPE errors when parent process dies
function safeLog(...args) {
  if (parentProcessDead) return; // Don't attempt logging if parent is suspected dead
  
  try {
    console.log(...args);
  } catch (err) {
    if (err.code === 'EPIPE' || err.errno === -32) {
      parentProcessDead = true; // Mark parent as dead to prevent future attempts
      process.exit(0); // Exit immediately on EPIPE
    }
    // Ignore other errors silently
  }
}

function safeError(...args) {
  if (parentProcessDead) return; // Don't attempt logging if parent is suspected dead
  
  try {
    console.error(...args);
  } catch (err) {
    if (err.code === 'EPIPE' || err.errno === -32) {
      parentProcessDead = true; // Mark parent as dead to prevent future attempts
      process.exit(0); // Exit immediately on EPIPE
    }
    // Ignore other errors silently
  }
}

function safeStdout(data) {
  if (parentProcessDead) return; // Don't attempt stdout if parent is suspected dead
  
  try {
    process.stdout.write(data);
  } catch (err) {
    if (err.code === 'EPIPE' || err.errno === -32) {
      parentProcessDead = true; // Mark parent as dead to prevent future attempts
      process.exit(0); // Exit immediately on EPIPE
    }
    // For other errors, try stderr as fallback
    try {
      process.stderr.write(`stdout error: ${err.message}\n`);
    } catch (e) {
      // Both stdout and stderr are broken, parent is likely dead
      parentProcessDead = true;
      process.exit(0);
    }
  }
}

safeLog('Main.js loaded successfully');
safeLog('Electron modules:', { 
  app: !!app, 
  BrowserWindow: !!BrowserWindow, 
  ipcMain: !!ipcMain, 
  screen: !!screen,
  globalShortcut: !!globalShortcut,
  protocol: !!protocol
});

// Store parent process ID for monitoring
const parentPid = process.ppid || process.env.RITALIN_PARENT_PID;
safeLog('Parent process ID:', parentPid);

// Monitor parent process - exit if parent dies
if (parentPid) {
  const checkParentInterval = setInterval(() => {
    try {
      // Check if parent process is still alive
      process.kill(parentPid, 0); // Signal 0 just checks if process exists
    } catch (error) {
      parentProcessDead = true; // Mark parent as dead
      safeLog('Parent process no longer exists, exiting...');
      clearInterval(checkParentInterval);
      // Force quit immediately without waiting for graceful shutdown
      process.exit(0);
    }
  }, 500); // Check every 500ms for faster detection during development
  
  // Clean up interval on app quit
  app.on('before-quit', () => {
    clearInterval(checkParentInterval);
  });
}

// Monitor stdin disconnection (happens when parent process dies)
process.stdin.on('end', () => {
  parentProcessDead = true; // Mark parent as dead
  safeLog('stdin disconnected, parent likely died - exiting...');
  // Force exit immediately to prevent hanging
  process.exit(0);
});

process.stdin.on('error', (err) => {
  parentProcessDead = true; // Mark parent as dead
  safeLog('stdin error, parent likely died - exiting...', err.message);
  // Force exit immediately to prevent hanging
  process.exit(0);
});

// Monitor stdout/stderr for EPIPE errors (indicates parent died)
process.stdout.on('error', (err) => {
  if (err.code === 'EPIPE' || err.errno === -32) {
    parentProcessDead = true;
    safeLog('stdout EPIPE error, parent died - exiting...');
    process.exit(0);
  }
});

process.stderr.on('error', (err) => {
  if (err.code === 'EPIPE' || err.errno === -32) {
    parentProcessDead = true;
    safeLog('stderr EPIPE error, parent died - exiting...');
    process.exit(0);
  }
});

// Exit after 5 seconds of no communication (more aggressive for development)
let lastCommunication = Date.now();
const communicationTimeout = setInterval(() => {
  const timeSinceLastComm = Date.now() - lastCommunication;
  if (timeSinceLastComm > 5000) { // 5 seconds (more aggressive for development)
    parentProcessDead = true; // Mark parent as dead
    safeLog('No communication for 5 seconds, assuming parent died - exiting...');
    // Force exit immediately to prevent hanging
    process.exit(0);
  }
}, 1000); // Check every 1 second (more frequent)

app.on('before-quit', () => {
  clearInterval(communicationTimeout);
});

let mainWindow;
let gameServer = null;
let gameServerPort = 0;
let currentGamePath = null;
let windowPreferences = {
  enabled: false,
  position: 'bottom-left',
  customX: 0,
  customY: 0,
  width: 800,  // Reasonable default when not specified
  height: 600, // Reasonable default when not specified
  monitor: 'primary',
  alwaysOnTop: true,
  hideOnBlur: false
};

// Try to read window preferences from environment
try {
  if (process.env.RITALIN_WINDOW_PREFS) {
    windowPreferences = JSON.parse(process.env.RITALIN_WINDOW_PREFS);
    safeLog('Loaded window preferences:', windowPreferences);
  }
} catch (e) {
  safeError('Failed to parse window preferences:', e);
}

app.commandLine.appendSwitch('enable-webgl');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-accelerated-2d-canvas');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('disable-gpu-sandbox');

// Cross-platform function to find the best monitor for our game window
function findBestMonitorForGameWindow() {
  const displays = screen.getAllDisplays();
  const cursorPoint = screen.getCursorScreenPoint();
  
  // Method 1: Find monitor containing cursor
  const cursorDisplay = screen.getDisplayNearestPoint(cursorPoint);
  
  // Method 2: Try to detect which monitor likely has VS Code/Cursor
  // We'll use some heuristics:
  // 1. If we have VS Code window state, use that
  // 2. Otherwise, prefer the monitor with the cursor
  // 3. As a last resort, use the primary monitor
  
  let vsCodeWindow = null;
  try {
    if (process.env.RITALIN_VSCODE_WINDOW) {
      vsCodeWindow = JSON.parse(process.env.RITALIN_VSCODE_WINDOW);
      safeLog('VS Code window state:', vsCodeWindow);
    }
  } catch (e) {
    safeLog('Could not parse VS Code window state');
  }
  
  // For now, we'll use the cursor position as the best indicator
  // This works well because users typically have their cursor in the window they're working in
  safeLog('Cursor at:', cursorPoint);
  safeLog('Cursor display:', cursorDisplay.bounds);
  
  return {
    targetDisplay: cursorDisplay,
    cursorPoint: cursorPoint,
    displays: displays
  };
}

// Get the path for storing game state
function getGameStatePath() {
  // Use app.getPath('userData') which persists across sessions
  const userDataPath = app.getPath('userData');
  const gameStatePath = path.join(userDataPath, 'game-state');
  
  // Ensure directory exists
  if (!fs.existsSync(gameStatePath)) {
    fs.mkdirSync(gameStatePath, { recursive: true });
  }
  
  return gameStatePath;
}

// Save all game state (localStorage, sessionStorage, cookies, IndexedDB)
async function saveGameState() {
  if (!mainWindow) return;
  
  try {
    const gameStatePath = getGameStatePath();
    
    // Execute JavaScript in the renderer to get all storage data
    const storageData = await mainWindow.webContents.executeJavaScript(`
      (function() {
        const data = {
          localStorage: {},
          sessionStorage: {},
          cookies: document.cookie,
          timestamp: Date.now()
        };
        
        // Get localStorage
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          data.localStorage[key] = localStorage.getItem(key);
        }
        
        // Get sessionStorage
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          data.sessionStorage[key] = sessionStorage.getItem(key);
        }
        
        return data;
      })();
    `);
    
    // Save to file
    const statePath = path.join(gameStatePath, 'storage.json');
    fs.writeFileSync(statePath, JSON.stringify(storageData, null, 2));
    
    // Also save cookies using Electron's session API
    const cookies = await mainWindow.webContents.session.cookies.get({});
    const cookiesPath = path.join(gameStatePath, 'cookies.json');
    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
    
    // Safe console logging to prevent EPIPE errors
    try {
      safeLog('Game state saved successfully');
    } catch (err) {
      // Ignore EPIPE errors when parent process is gone
    }
  } catch (error) {
    // Safe error logging to prevent EPIPE errors
    try {
      safeError('Failed to save game state:', error);
    } catch (err) {
      // Ignore EPIPE errors when parent process is gone
    }
  }
}

// Restore game state on startup
async function restoreGameState() {
  if (!mainWindow) return;
  
  try {
    const gameStatePath = getGameStatePath();
    const statePath = path.join(gameStatePath, 'storage.json');
    const cookiesPath = path.join(gameStatePath, 'cookies.json');
    
    // Restore localStorage and sessionStorage
    if (fs.existsSync(statePath)) {
      const storageData = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      
      await mainWindow.webContents.executeJavaScript(`
        (function() {
          // Only restore state in the main window, not in iframes
          if (window.parent !== window) {
            console.log('Skipping game state restoration in iframe');
            return;
          }
          
          const data = ${JSON.stringify(storageData)};
          
          // Restore localStorage
          Object.keys(data.localStorage || {}).forEach(key => {
            localStorage.setItem(key, data.localStorage[key]);
          });
          
          // Restore sessionStorage
          Object.keys(data.sessionStorage || {}).forEach(key => {
            sessionStorage.setItem(key, data.sessionStorage[key]);
          });
          
          // Restore cookies
          if (data.cookies) {
            document.cookie = data.cookies;
          }
          
          console.log('Game state restored from', new Date(data.timestamp));
        })();
      `);
    }
    
    // Restore cookies using Electron's session API
    if (fs.existsSync(cookiesPath)) {
      const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
      for (const cookie of cookies) {
        // Set each cookie back
        await mainWindow.webContents.session.cookies.set({
          url: cookie.domain ? `https://${cookie.domain}` : 'file://',
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          expirationDate: cookie.expirationDate
        }).catch(err => {
          // Some cookies might fail to set, that's okay
          safeLog('Failed to restore cookie:', cookie.name, err.message);
        });
      }
    }
    
    safeLog('Game state restored successfully');
  } catch (error) {
    safeError('Failed to restore game state:', error);
  }
}

// Handle permission requests - deny all by default
app.on('web-contents-created', (event, contents) => {
  contents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    // Deny all permission requests (microphone, camera, etc.)
    safeLog(`Permission requested: ${permission} - DENIED`);
    callback(false);
  });
});

// HTTP Server for serving game files
function createGameServer() {
  if (gameServer) {
    return Promise.resolve(gameServerPort);
  }

  return new Promise((resolve, reject) => {
    gameServer = http.createServer((req, res) => {
      if (!currentGamePath) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('No game loaded');
        return;
      }

      let requestPath = req.url;
      if (requestPath === '/') {
        requestPath = '/index.html';
      }

      // Remove query parameters and decode URL
      const cleanPath = decodeURIComponent(requestPath.split('?')[0]);
      const filePath = path.join(currentGamePath, cleanPath);

      // Security check - ensure file is within game directory
      const resolvedPath = path.resolve(filePath);
      const resolvedGamePath = path.resolve(currentGamePath);
      if (!resolvedPath.startsWith(resolvedGamePath)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Access denied');
        return;
      }

      // Check if file exists
      if (!fs.existsSync(resolvedPath)) {
        // For GameMaker games, serve placeholder files for missing assets
        const ext = path.extname(cleanPath).toLowerCase();
        
        if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.gif') {
          // Serve a 1x1 transparent PNG for missing images
          const transparentPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
          res.writeHead(200, { 
            'Content-Type': 'image/png',
            'Content-Length': transparentPng.length 
          });
          res.end(transparentPng);
          safeLog(`Served placeholder image for: ${requestPath}`);
          return;
        } else if (ext === '.ogg' || ext === '.mp3' || ext === '.wav') {
          // Serve empty audio file for missing sounds
          res.writeHead(200, { 
            'Content-Type': 'audio/ogg',
            'Content-Length': 0 
          });
          res.end();
          safeLog(`Served empty audio for: ${requestPath}`);
          return;
        } else if (ext === '.js') {
          // Serve empty JavaScript for missing scripts
          res.writeHead(200, { 
            'Content-Type': 'application/javascript',
            'Content-Length': 0 
          });
          res.end();
          safeLog(`Served empty script for: ${requestPath}`);
          return;
        }
        
        // For other files, return 404
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File not found');
        return;
      }

      // Get file stats
      const stats = fs.statSync(resolvedPath);
      if (stats.isDirectory()) {
        // Try to serve index.html from directory
        const indexPath = path.join(resolvedPath, 'index.html');
        if (fs.existsSync(indexPath)) {
          res.writeHead(301, { 'Location': requestPath + (requestPath.endsWith('/') ? '' : '/') + 'index.html' });
          res.end();
          return;
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Directory listing not allowed');
          return;
        }
      }

      // Determine MIME type using built-in mapping
      const contentType = getMimeType(resolvedPath);

      // Set CORS headers for local development
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Cross-Origin-Embedder-Policy', 'cross-origin');
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Read and serve file
      try {
        const fileContent = fs.readFileSync(resolvedPath);
        const headers = { 
          'Content-Type': contentType,
          'Content-Length': fileContent.length 
        };
        
        // Unity WebGL expects to decompress .gz files itself, so we should NOT add Content-Encoding
        // The browser would try to decompress if we add Content-Encoding: gzip
        // Just serve the compressed file as-is with the appropriate MIME type
        
        res.writeHead(200, headers);
        res.end(fileContent);
        safeLog(`Served: ${requestPath} (${contentType})`);
      } catch (error) {
        safeError('Error reading file:', error);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal server error');
      }
    });

    // Find available port starting from 17000 to avoid common dev ports
    // Common dev ports to avoid: 3000-3999, 4000-4999, 5000-5999, 8000-8999, 9000-9999
    let port = 17000;
    const tryPort = () => {
      gameServer.listen(port, 'localhost', () => {
        gameServerPort = port;
        safeLog(`Game server started on http://localhost:${port}`);
        resolve(port);
      });

      gameServer.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          port++;
          if (port > 17100) {
            reject(new Error('Could not find available port'));
            return;
          }
          gameServer.close();
          gameServer = http.createServer(gameServer.listeners('request')[0]);
          tryPort();
        } else {
          reject(err);
        }
      });
    };

    tryPort();
  });
}

function stopGameServer() {
  if (gameServer) {
    gameServer.close();
    gameServer = null;
    gameServerPort = 0;
    currentGamePath = null;
    safeLog('Game server stopped');
  }
}

function createWindow() {
  // Get all displays
  const displays = screen.getAllDisplays();
  safeLog('Available displays:', displays.length);
  
  // Find the best monitor for our game window
  const { targetDisplay, cursorPoint } = findBestMonitorForGameWindow();
  
  safeLog('Selected display for game window:', targetDisplay.bounds);
  
  // Convert displays to our monitor format and send to extension
  const monitors = displays.map((display, index) => ({
    id: index,
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    isPrimary: display === screen.getPrimaryDisplay(),
    isActive: display.id === targetDisplay.id,
    cursorPoint: display.id === targetDisplay.id ? cursorPoint : null
  }));
  
  safeLog('Monitor info:', JSON.stringify(monitors, null, 2));
  
  // Send monitor info to extension (it will calculate position and send it back)
  safeStdout(JSON.stringify({ type: 'monitors', monitors }) + '\n');
  
  // Use preferences for initial window setup
  mainWindow = new BrowserWindow({
    width: windowPreferences.width || 800,   // Ensure we always have a valid width
    height: windowPreferences.height || 600, // Ensure we always have a valid height
    minWidth: 200,  // Minimum size so it doesn't become unusable
    minHeight: 150,
    maxWidth: 1200, // Maximum size to prevent it from becoming too large
    maxHeight: 800,
    x: 0,  // Will be set by extension based on preferences
    y: 0,  // Will be set by extension based on preferences
    frame: false,
    transparent: true,
    alwaysOnTop: windowPreferences.alwaysOnTop,
    skipTaskbar: true,
    resizable: true,
    show: false, // Keep window hidden initially - only show when explicitly requested
    hasShadow: windowPreferences.position !== 'overlay', // No shadow in overlay mode
    opacity: windowPreferences.position === 'overlay' ? 0.95 : 1.0, // Slight transparency in overlay
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Allow local files for Unity WebGL compatibility while maintaining security
      webSecurity: false, // Allow loading local files for Unity WebGL
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      enableBlinkFeatures: '', // Disable all blink features
      // Disable features that might trigger permission requests
      navigateOnDragDrop: false,
      autoplayPolicy: 'no-user-gesture-required'
    }
  });

  mainWindow.loadFile('index.html');
  
  // Developer tools can be opened with Cmd/Ctrl+Shift+I if needed
  // mainWindow.webContents.openDevTools();
  
  // Set proper MIME types for Unity WebGL files
  mainWindow.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
    // Add headers to ensure proper MIME type handling
    details.requestHeaders['Accept'] = '*/*';
    callback({ requestHeaders: details.requestHeaders });
  });
  
  // Handle MIME type responses for Unity WebGL files
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const url = details.url;
    if (url.endsWith('.wasm')) {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Type': ['application/wasm']
        }
      });
    } else if (url.endsWith('.data') || url.endsWith('.unity3d') || url.endsWith('.framework') || url.endsWith('.loader')) {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Type': ['application/octet-stream']
        }
      });
    } else {
      callback({ responseHeaders: details.responseHeaders });
    }
  });
  
  // Block unnecessary permission requests
  mainWindow.webContents.on('permission-request', (event, webContents, permission, callback) => {
    safeLog('Permission requested:', permission, '- DENIED');
    // Deny all permission requests - games don't need them
    callback(false);
  });
  
  // Block permission requests for specific features
  mainWindow.webContents.on('permission-request-handler', (event, webContents, permission, callback) => {
    safeLog('Permission handler requested:', permission, '- DENIED');
    callback(false);
  });
  
  // Restore game state when the window loads
  mainWindow.webContents.on('did-finish-load', () => {
    safeLog('Window loaded, restoring game state...');
    restoreGameState();
    
    // Mute audio by default since window starts hidden
    mainWindow.webContents.setAudioMuted(true);
    safeLog('Game audio muted (window starts hidden)');
    
    // Disable debugger statements in all contexts
    mainWindow.webContents.executeJavaScript(`
      // Disable debugger in main window
      const disableDebugger = function() {
        const noop = function() {};
        try {
          Object.defineProperty(window, 'debugger', {
            get: function() { return noop; },
            set: function() {}
          });
        } catch(e) {}
        
        // Also try to patch eval to remove debugger statements
        const originalEval = window.eval;
        window.eval = function(code) {
          if (typeof code === 'string') {
            code = code.replace(/\\bdebugger\\b/g, '');
          }
          return originalEval.call(this, code);
        };
      };
      
      disableDebugger();
      
      // Also disable in any iframes
      const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          mutation.addedNodes.forEach(function(node) {
            if (node.tagName === 'IFRAME') {
              node.addEventListener('load', function() {
                try {
                  node.contentWindow.eval(disableDebugger.toString() + '; disableDebugger();');
                } catch(e) {}
              });
            }
          });
        });
      });
      
      observer.observe(document.body, { childList: true, subtree: true });
      console.log('Debugger statements disabled');
    `);
  });
  
  // Save game state periodically (every 30 seconds)
  setInterval(() => {
    saveGameState();
  }, 30000);
  
  // Save game state when window is about to close
  mainWindow.on('close', (event) => {
    // Don't close immediately, save state first
    event.preventDefault();
    saveGameState().then(() => {
      // Now actually close
      mainWindow.destroy();
    });
  });
  
  // Set always on top behavior based on preferences
  if (windowPreferences.alwaysOnTop) {
    mainWindow.setAlwaysOnTop(true, 'floating');
  }
  
  // Special handling for overlay mode
  if (windowPreferences.position === 'overlay') {
    // Make window level higher for true overlay effect
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    // Enable click-through when window loses focus (so you can still use Cursor)
    mainWindow.on('blur', () => {
      if (windowPreferences.position === 'overlay') {
        mainWindow.setIgnoreMouseEvents(true);
      }
    });
    // Re-enable mouse events when window gains focus
    mainWindow.on('focus', () => {
      mainWindow.setIgnoreMouseEvents(false);
    });
  }
  
  // Handle hide on blur if enabled
  if (windowPreferences.hideOnBlur && windowPreferences.position !== 'overlay') {
    mainWindow.on('blur', () => {
      mainWindow.hide();
    });
  }
  
  // Prevent navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
    }
  });
  
  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupIPC() {
  // IPC handlers for renderer process
  ipcMain.on('window-control', (event, action) => {
    if (!mainWindow) return;
    
    switch (action) {
      case 'minimize':
        mainWindow.minimize();
        break;
      case 'close':
        mainWindow.hide();
        break;
    }
  });
  
  // Handle IndexedDB changes
  ipcMain.on('indexeddb-changed', () => {
    safeLog('IndexedDB changed, saving game state...');
    saveGameState();
  });
  
  // Check if we're using file-based IPC (when spawned with stdio: 'inherit')
  const ipcPath = process.env.RITALIN_IPC_PATH;
  if (ipcPath) {
    safeLog('Using file-based IPC at:', ipcPath);
    
    // Watch the IPC file for changes
    let lastSize = 0;
    const checkFile = () => {
      try {
        const stats = fs.statSync(ipcPath);
        if (stats.size > lastSize) {
          // Read new content
          const content = fs.readFileSync(ipcPath, 'utf8');
          const newContent = content.slice(lastSize);
          lastSize = stats.size;
          
          // Process new lines
          const lines = newContent.split('\n').filter(line => line.trim());
          lines.forEach(line => {
            try {
              const message = JSON.parse(line);
              handleExtensionMessage(message);
            } catch (e) {
              safeError('Failed to parse IPC message:', e, 'Line:', line);
            }
          });
        }
      } catch (e) {
        // File doesn't exist yet, ignore
      }
    };
    
    // Check file every 100ms
    setInterval(checkFile, 100);
    
    // Clean up file on exit
    app.on('before-quit', () => {
      try {
        fs.unlinkSync(ipcPath);
      } catch (e) {
        // Ignore
      }
    });
  } else {
    // When not using file-based IPC, no stdin handler is needed
    // because the wrapper script handles all communication
    safeLog('No IPC path provided, expecting no direct stdin communication');
  }
  
  // Handle IPC messages from parent process (if using stdio: 'ipc')
  process.on('message', (message) => {
    safeLog('Received IPC message from parent:', message);
    handleExtensionMessage(message);
    
    // Send acknowledgment back
    if (process.send) {
      process.send({ type: 'ack', originalCommand: message.command });
    }
  });
}

function handleExtensionMessage(message) {
  safeLog('Handling message:', JSON.stringify(message));
  
  // Update communication timestamp
  lastCommunication = Date.now();
  
  if (!mainWindow) {
    safeLog('No mainWindow available');
    return;
  }
  
  switch (message.command) {
    case 'ping':
      // This command's purpose is to reset the communication timeout.
      // We can send a 'pong' back for debugging or future use.
      safeStdout(JSON.stringify({ type: 'pong', timestamp: Date.now() }) + '\n');
      break;
    case 'show':
      safeLog('Showing window');
      mainWindow.show();
      // Unmute audio when showing the window
      mainWindow.webContents.setAudioMuted(false);
      safeLog('Game audio unmuted');
      // Send acknowledgment
      safeStdout(JSON.stringify({ type: 'shown' }) + '\n');
      break;
      
    case 'hide':
      safeLog('Hiding window');
      // Mute audio when hiding the window
      mainWindow.webContents.setAudioMuted(true);
      safeLog('Game audio muted');
      mainWindow.hide();
      safeStdout(JSON.stringify({ type: 'hidden' }) + '\n');
      break;
      
    case 'loadGame':
      safeLog('Loading game from path:', message.gamePath);
      
      // Check if it's an HTTP/HTTPS URL that should be loaded directly
      if (message.gamePath.startsWith('http://') || message.gamePath.startsWith('https://')) {
        safeLog('Loading external URL directly:', message.gamePath);
        mainWindow.webContents.send('load-game', message.gamePath);
        break;
      }
      
      // Extract the file path from file:// URL if present
      let gamePath = message.gamePath;
      if (gamePath.startsWith('file://')) {
        gamePath = gamePath.replace('file://', '');
        // Handle Windows paths
        if (process.platform === 'win32' && gamePath.startsWith('/')) {
          gamePath = gamePath.substring(1);
        }
      }
      
      // Set the game path for the server
      currentGamePath = path.dirname(gamePath);
      
      // Start the HTTP server
      createGameServer().then((port) => {
        // Load the game via HTTP instead of file://
        const gameFileName = path.basename(gamePath);
        const httpUrl = `http://localhost:${port}/${gameFileName}`;
        safeLog('Loading game via HTTP:', httpUrl);
        mainWindow.webContents.send('load-game', httpUrl);
      }).catch((error) => {
        safeError('Failed to start game server:', error);
        // Fallback to file:// loading if server fails
      mainWindow.webContents.send('load-game', message.gamePath);
      });
      break;
      
    case 'setPosition':
      if (message.x !== undefined && message.y !== undefined) {
        safeLog(`Setting window position to: ${message.x}, ${message.y}`);
        mainWindow.setPosition(message.x, message.y);
        
        // Verify the position was set correctly
        const [actualX, actualY] = mainWindow.getPosition();
        safeLog(`Window position after setting: ${actualX}, ${actualY}`);
      }
      break;
      
    case 'setSize':
      if (message.width !== undefined && message.height !== undefined) {
        safeLog(`Setting window size to: ${message.width}x${message.height}`);
        mainWindow.setSize(message.width, message.height);
        
        // Verify the size was set correctly
        const [actualWidth, actualHeight] = mainWindow.getSize();
        safeLog(`Window size after setting: ${actualWidth}x${actualHeight}`);
      }
      break;
      
    case 'saveGameState':
      safeLog('Manually saving game state...');
      saveGameState().then(() => {
        safeStdout(JSON.stringify({ type: 'gameStateSaved' }) + '\n');
      });
      break;
      
    case 'loadGameState':
      safeLog('Manually loading game state...');
      restoreGameState().then(() => {
        safeStdout(JSON.stringify({ type: 'gameStateLoaded' }) + '\n');
      });
      break;
      
    case 'clearGameState':
      safeLog('Clearing game state...');
      const gameStatePath = getGameStatePath();
      try {
        fs.rmSync(gameStatePath, { recursive: true, force: true });
        // Clear current browser storage
        mainWindow.webContents.executeJavaScript(`
          localStorage.clear();
          sessionStorage.clear();
          console.log('Game state cleared');
        `);
        safeStdout(JSON.stringify({ type: 'gameStateCleared' }) + '\n');
      } catch (error) {
        safeError('Failed to clear game state:', error);
      }
      break;
      
    case 'quit':
      app.quit();
      break;
  }
}

// Send ready signal when app is ready
app.whenReady().then(() => {
  // Register custom protocol for serving game files with proper MIME types
  protocol.registerFileProtocol('game', (request, callback) => {
    const url = request.url.replace('game://', '');
    const filePath = decodeURIComponent(url);
    
    // Set proper MIME types for Unity WebGL files
    const mimeTypes = {
      '.wasm': 'application/wasm',
      '.data': 'application/octet-stream',
      '.unity3d': 'application/octet-stream',
      '.framework': 'application/octet-stream',
      '.loader': 'application/octet-stream',
      '.js': 'application/javascript',
      '.html': 'text/html',
      '.css': 'text/css',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.eot': 'application/vnd.ms-fontobject',
      '.otf': 'font/otf'
    };
    
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    
    callback({
      path: filePath,
      headers: {
        'Content-Type': mimeType
      }
    });
  });

  createWindow();
  setupIPC();
  
  // Register global shortcut for overlay mode toggle (Cmd/Ctrl+Shift+G)
  const toggleShortcut = process.platform === 'darwin' ? 'Cmd+Shift+G' : 'Ctrl+Shift+G';
  globalShortcut.register(toggleShortcut, () => {
    if (mainWindow && windowPreferences.position === 'overlay') {
      const isIgnoring = mainWindow.isAlwaysOnTop();
      if (isIgnoring) {
        // Make interactive
        mainWindow.setIgnoreMouseEvents(false);
        mainWindow.setOpacity(1.0);
        safeLog('Overlay mode: Interactive');
      } else {
        // Make click-through
        mainWindow.setIgnoreMouseEvents(true);
        mainWindow.setOpacity(0.7);
        safeLog('Overlay mode: Click-through');
      }
    }
  });
  
  // Register developer tools shortcut (Cmd/Ctrl+Shift+I)
  const devToolsShortcut = process.platform === 'darwin' ? 'Cmd+Shift+I' : 'Ctrl+Shift+I';
  globalShortcut.register(devToolsShortcut, () => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.toggleDevTools();
      safeLog('Developer tools toggled');
    }
  });
  
  safeStdout(JSON.stringify({ type: 'ready' }) + '\n');
  
  // Also send via IPC if available
  if (process.send) {
    process.send({ type: 'ready' });
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Handle process termination gracefully
process.on('SIGTERM', () => {
  app.quit();
});

process.on('SIGINT', () => {
  app.quit();
});

app.on('will-quit', () => {
  // Stop the game server
  stopGameServer();
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
}); 