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

// Expose game state persistence API
contextBridge.exposeInMainWorld('gameStateAPI', {
  // Override IndexedDB to add persistence hooks
  setupPersistence: () => {
    // Only run in the main window, not in iframes
    if (window.parent !== window) {
      console.log('Skipping persistence setup in iframe');
      return;
    }
    
    console.log('Setting up game state persistence...');
    
    // Hook into IndexedDB operations
    const originalOpen = indexedDB.open;
    indexedDB.open = function(...args) {
      console.log('IndexedDB open called:', args[0]);
      const request = originalOpen.apply(this, args);
      
      // Add success handler to track database changes
      request.onsuccess = function(event) {
        console.log('IndexedDB opened successfully');
        const db = event.target.result;
        
        // Hook into transaction creation to track changes
        const originalTransaction = db.transaction;
        db.transaction = function(...transArgs) {
          const transaction = originalTransaction.apply(this, transArgs);
          
          transaction.oncomplete = function() {
            console.log('IndexedDB transaction completed, triggering save...');
            // Notify main process to save state
            ipcRenderer.send('indexeddb-changed');
          };
          
          return transaction;
        };
      };
      
      return request;
    };
  }
});

// Auto-setup persistence when the page loads
window.addEventListener('DOMContentLoaded', () => {
  // Check if gameStateAPI exists before calling setupPersistence
  if (window.gameStateAPI && window.gameStateAPI.setupPersistence) {
    window.gameStateAPI.setupPersistence();
  }
}); 