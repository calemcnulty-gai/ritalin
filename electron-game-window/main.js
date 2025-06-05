console.log('=== MAIN.JS STARTING ===');
console.log('__dirname:', __dirname);
console.log('process.cwd():', process.cwd());
console.log('process.argv:', process.argv);
console.log('process.versions:', process.versions);
console.log('Is Electron?', !!process.versions.electron);

const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

console.log('Electron modules loaded:', { app: !!app, BrowserWindow: !!BrowserWindow, ipcMain: !!ipcMain, screen: !!screen });

let mainWindow;

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
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
  
  // Prevent window from being hidden when it loses focus
  mainWindow.setAlwaysOnTop(true, 'floating');
  
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
  
  // Handle stdin for IPC from extension
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