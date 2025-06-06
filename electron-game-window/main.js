const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

console.log('Main.js loaded successfully');
console.log('Electron modules:', { 
  app: !!app, 
  BrowserWindow: !!BrowserWindow, 
  ipcMain: !!ipcMain, 
  screen: !!screen 
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

// Function to detect Cursor's window position on macOS
function detectCursorWindowPosition() {
  return new Promise((resolve) => {
    if (process.platform !== 'darwin') {
      console.log('Window detection only supported on macOS, falling back to cursor position');
      resolve(null);
      return;
    }

    // AppleScript to get Cursor window position and size
    const script = `
      tell application "System Events"
        try
          set cursorApp to first application process whose name contains "Cursor"
          set cursorWindow to first window of cursorApp
          set windowPosition to position of cursorWindow
          set windowSize to size of cursorWindow
          return (item 1 of windowPosition) & "," & (item 2 of windowPosition) & "," & (item 1 of windowSize) & "," & (item 2 of windowSize)
        on error
          return "error"
        end try
      end tell
    `;

    exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
      if (error || stderr || stdout.trim() === 'error') {
        console.log('Could not detect Cursor window position:', error || stderr || 'Application not found');
        resolve(null);
        return;
      }

      const parts = stdout.trim().split(',');
      if (parts.length === 4) {
        const windowInfo = {
          x: parseInt(parts[0]),
          y: parseInt(parts[1]),
          width: parseInt(parts[2]),
          height: parseInt(parts[3])
        };
        console.log('Detected Cursor window:', windowInfo);
        resolve(windowInfo);
      } else {
        console.log('Invalid window position data:', stdout);
        resolve(null);
      }
    });
  });
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
  
  // Detect Cursor's actual window position
  detectCursorWindowPosition().then((cursorWindow) => {
    let cursorMonitor = null;
    
    if (cursorWindow) {
      // Find which monitor contains the Cursor window
      cursorMonitor = displays.find(display => {
        const bounds = display.bounds;
        return cursorWindow.x >= bounds.x && 
               cursorWindow.x < bounds.x + bounds.width &&
               cursorWindow.y >= bounds.y && 
               cursorWindow.y < bounds.y + bounds.height;
      });
      
      if (cursorMonitor) {
        console.log('Found Cursor on monitor:', cursorMonitor.bounds);
      } else {
        console.log('Could not determine which monitor contains Cursor window');
      }
    }
    
    // If we couldn't detect Cursor's window, fall back to cursor position
    if (!cursorMonitor) {
      const cursorPoint = screen.getCursorScreenPoint();
      cursorMonitor = screen.getDisplayNearestPoint(cursorPoint);
      console.log('Falling back to cursor position method');
      console.log('Cursor position:', cursorPoint);
    }
    
    console.log('Selected monitor bounds:', cursorMonitor.bounds);
    
    // Convert displays to our monitor format and send to extension
    const monitors = displays.map((display, index) => ({
      id: index,
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      isPrimary: display === screen.getPrimaryDisplay(),
      isActive: display === cursorMonitor, // Monitor where Cursor is running
      cursorWindow: display === cursorMonitor ? cursorWindow : null
    }));
    
    console.log('Monitor info:', monitors);
    
    // Send monitor info to extension (it will calculate position and send it back)
    process.stdout.write(JSON.stringify({ type: 'monitors', monitors }) + '\n');
  });
  
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
    hasShadow: true,
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
  
  // Handle hide on blur if enabled
  if (windowPreferences.hideOnBlur) {
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