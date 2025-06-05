const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  onLoadGame: (callback) => {
    ipcRenderer.on('load-game', (event, gamePath) => callback(gamePath));
  },
  sendWindowControl: (action) => {
    ipcRenderer.send('window-control', action);
  },
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
}); 