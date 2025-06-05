const { app, BrowserWindow } = require('electron');

console.log('Test: app is', typeof app);
console.log('Test: BrowserWindow is', typeof BrowserWindow);

if (app && BrowserWindow) {
  app.whenReady().then(() => {
    const win = new BrowserWindow({
      width: 400,
      height: 300,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
    
    win.loadURL('data:text/html,<h1>It works!</h1>');
    
    setTimeout(() => {
      console.log('Test successful!');
      app.quit();
    }, 3000);
  });
} else {
  console.error('Electron modules not available!');
  process.exit(1);
} 