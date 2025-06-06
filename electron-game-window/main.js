const { app, BrowserWindow, ipcMain, screen, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

console.log('Main.js loaded successfully');
console.log('Electron modules:', { 
  app: !!app, 
  BrowserWindow: !!BrowserWindow, 
  ipcMain: !!ipcMain, 
  screen: !!screen,
  globalShortcut: !!globalShortcut
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
    console.log('Loaded window preferences:', windowPreferences);
  }
} catch (e) {
  console.error('Failed to parse window preferences:', e);
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
      console.log('VS Code window state:', vsCodeWindow);
    }
  } catch (e) {
    console.log('Could not parse VS Code window state');
  }
  
  // For now, we'll use the cursor position as the best indicator
  // This works well because users typically have their cursor in the window they're working in
  console.log('Cursor at:', cursorPoint);
  console.log('Cursor display:', cursorDisplay.bounds);
  
  return {
    targetDisplay: cursorDisplay,
    cursorPoint: cursorPoint,
    displays: displays
  };
}

// Handle permission requests - deny all by default
app.on('web-contents-created', (event, contents) => {
  contents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    // Deny all permission requests (microphone, camera, etc.)
    console.log(`Permission requested: ${permission} - DENIED`);
    callback(false);
  });
});

function createWindow() {
  // Get all displays
  const displays = screen.getAllDisplays();
  console.log('Available displays:', displays.length);
  
  // Find the best monitor for our game window
  const { targetDisplay, cursorPoint } = findBestMonitorForGameWindow();
  
  console.log('Selected display for game window:', targetDisplay.bounds);
  
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
  
  console.log('Monitor info:', JSON.stringify(monitors, null, 2));
  
  // Send monitor info to extension (it will calculate position and send it back)
  process.stdout.write(JSON.stringify({ type: 'monitors', monitors }) + '\n');
  
  // Use preferences for initial window setup
  mainWindow = new BrowserWindow({
    width: windowPreferences.width,
    height: windowPreferences.height,
    x: 0,  // Will be set by extension based on preferences
    y: 0,  // Will be set by extension based on preferences
    frame: false,
    transparent: true,
    alwaysOnTop: windowPreferences.alwaysOnTop,
    skipTaskbar: true,
    resizable: false,
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
  
  // Check if we're using file-based IPC (when spawned with stdio: 'inherit')
  const ipcPath = process.env.RITALIN_IPC_PATH;
  if (ipcPath) {
    console.log('Using file-based IPC at:', ipcPath);
    
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
              console.error('Failed to parse IPC message:', e, 'Line:', line);
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
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      lines.forEach(line => {
        if (!line.trim()) return;
        
        try {
          const message = JSON.parse(line);
          handleExtensionMessage(message);
        } catch (e) {
          console.error('Failed to parse IPC message:', e, 'Line:', line);
        }
      });
    });
  }
  
  // Handle IPC messages from parent process (if using stdio: 'ipc')
  process.on('message', (message) => {
    console.log('Received IPC message from parent:', message);
    handleExtensionMessage(message);
    
    // Send acknowledgment back
    if (process.send) {
      process.send({ type: 'ack', originalCommand: message.command });
    }
  });
}

function handleExtensionMessage(message) {
  console.log('Handling message:', JSON.stringify(message));
  if (!mainWindow) {
    console.log('No mainWindow available');
    return;
  }
  
  switch (message.command) {
    case 'show':
      console.log('Showing window');
      mainWindow.show();
      // Send acknowledgment
      process.stdout.write(JSON.stringify({ type: 'shown' }) + '\n');
      break;
      
    case 'hide':
      console.log('Hiding window');
      mainWindow.hide();
      process.stdout.write(JSON.stringify({ type: 'hidden' }) + '\n');
      break;
      
    case 'loadGame':
      console.log('Loading game from path:', message.gamePath);
      mainWindow.webContents.send('load-game', message.gamePath);
      break;
      
    case 'setPosition':
      if (message.x !== undefined && message.y !== undefined) {
        console.log(`Setting window position to: ${message.x}, ${message.y}`);
        mainWindow.setPosition(message.x, message.y);
        
        // Verify the position was set correctly
        const [actualX, actualY] = mainWindow.getPosition();
        console.log(`Window position after setting: ${actualX}, ${actualY}`);
      }
      break;
      
    case 'setSize':
      if (message.width !== undefined && message.height !== undefined) {
        console.log(`Setting window size to: ${message.width}x${message.height}`);
        mainWindow.setSize(message.width, message.height);
        
        // Verify the size was set correctly
        const [actualWidth, actualHeight] = mainWindow.getSize();
        console.log(`Window size after setting: ${actualWidth}x${actualHeight}`);
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
        console.log('Overlay mode: Interactive');
      } else {
        // Make click-through
        mainWindow.setIgnoreMouseEvents(true);
        mainWindow.setOpacity(0.7);
        console.log('Overlay mode: Click-through');
      }
    }
  });
  
  process.stdout.write(JSON.stringify({ type: 'ready' }) + '\n');
  
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