const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

console.log('Main.js loaded successfully');
console.log('Electron modules:', { 
  app: !!app, 
  BrowserWindow: !!BrowserWindow, 
  ipcMain: !!ipcMain, 
  screen: !!screen 
});

let mainWindow;

// Disable hardware acceleration to prevent some permission prompts
app.disableHardwareAcceleration();

// Handle permission requests - deny all by default
app.on('web-contents-created', (event, contents) => {
  contents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    // Deny all permission requests (microphone, camera, etc.)
    console.log(`Permission requested: ${permission} - DENIED`);
    callback(false);
  });
});

function createWindow() {
  // Get primary display dimensions
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  
  mainWindow = new BrowserWindow({
    width: 400,
    height: 300,
    x: 0,  // Position at left edge
    y: height - 300,  // Position at bottom
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Additional security settings to prevent permission requests
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      enableBlinkFeatures: '', // Disable all blink features
      // Disable features that might trigger permission requests
      navigateOnDragDrop: false,
      autoplayPolicy: 'no-user-gesture-required'
    }
  });

  mainWindow.loadFile('index.html');
  
  // Prevent window from being hidden when it loses focus
  mainWindow.setAlwaysOnTop(true, 'floating');
  
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
      mainWindow.show();
      // Send acknowledgment
      process.stdout.write(JSON.stringify({ type: 'shown' }) + '\n');
      break;
      
    case 'hide':
      mainWindow.hide();
      process.stdout.write(JSON.stringify({ type: 'hidden' }) + '\n');
      break;
      
    case 'loadGame':
      console.log('Loading game from path:', message.gamePath);
      mainWindow.webContents.send('load-game', message.gamePath);
      break;
      
    case 'setPosition':
      if (message.x !== undefined && message.y !== undefined) {
        mainWindow.setPosition(message.x, message.y);
      }
      break;
      
    case 'setSize':
      if (message.width !== undefined && message.height !== undefined) {
        mainWindow.setSize(message.width, message.height);
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