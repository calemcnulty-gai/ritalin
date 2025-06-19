const { app, BrowserWindow, ipcMain, screen, globalShortcut, session } = require('electron');
const path = require('path');
const fs = require('fs');

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
  globalShortcut: !!globalShortcut
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
  }, 1000); // Check every 1 second (faster detection)
  
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

// Exit after 10 seconds of no communication (fallback cleanup)
let lastCommunication = Date.now();
const communicationTimeout = setInterval(() => {
  const timeSinceLastComm = Date.now() - lastCommunication;
  if (timeSinceLastComm > 10000) { // 10 seconds (more aggressive)
    parentProcessDead = true; // Mark parent as dead
    safeLog('No communication for 10 seconds, assuming parent died - exiting...');
    // Force exit immediately to prevent hanging
    process.exit(0);
  }
}, 2000); // Check every 2 seconds (more frequent)

app.on('before-quit', () => {
  clearInterval(communicationTimeout);
});

let mainWindow;
let windowPreferences = {
  enabled: false,
  position: 'bottom-left',
  customX: 0,
  customY: 0,
  width: 400,
  height: 300,
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

// Enable WebGL and GPU features for Unity games
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
    width: windowPreferences.width,
    height: windowPreferences.height,
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
      // Additional security settings to prevent permission requests
      webSecurity: false, // Allow loading local files
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      enableBlinkFeatures: '', // Disable all blink features
      // Disable features that might trigger permission requests
      navigateOnDragDrop: false,
      autoplayPolicy: 'no-user-gesture-required'
    }
  });

  mainWindow.loadFile('index.html');
  
  // Restore game state when the window loads
  mainWindow.webContents.on('did-finish-load', () => {
    safeLog('Window loaded, restoring game state...');
    restoreGameState();
    
    // Mute audio by default since window starts hidden
    mainWindow.webContents.setAudioMuted(true);
    safeLog('Game audio muted (window starts hidden)');
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

// Handle stdin for IPC from extension
let buffer = '';

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
    // Use stdin for IPC (when run directly)
    process.stdin.on('data', (data) => {
      // Update communication timestamp
      lastCommunication = Date.now();
      
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      lines.forEach(line => {
        if (!line.trim()) return;
        
        try {
          const message = JSON.parse(line);
          handleExtensionMessage(message);
        } catch (e) {
          safeError('Failed to parse IPC message:', e, 'Line:', line);
        }
      });
    });
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
      mainWindow.webContents.send('load-game', message.gamePath);
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
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
}); 