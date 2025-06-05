# External Game Window Planning

## Overview
Planning document for implementing a floating external window for Ritalin games that can be positioned independently of Cursor's UI constraints.

## Potential Issues to Research

### 1. Cross-Platform Window Management
- [x] Window creation differences between Windows/macOS/Linux
- [x] Window positioning and focus management
- [x] Transparency and window chrome options
- [x] Always-on-top functionality

### 2. Process Management
- [x] Child process spawning from VS Code extension
- [x] IPC communication between extension and window
- [x] Process lifecycle management
- [x] Handling unexpected termination

### 3. Security and Permissions
- [x] VS Code extension security restrictions
- [x] Electron/window process sandboxing
- [x] File system access for games
- [x] Network access if needed

### 4. Performance and Resources
- [x] Memory usage of separate process
- [x] CPU impact of running games
- [x] Graphics acceleration support
- [x] Multiple window instances

### 5. User Experience
- [x] Window state persistence
- [x] Multi-monitor support
- [x] Window docking/snapping
- [x] Integration with OS window managers

### 6. Technical Implementation
- [x] Best approach for window creation (Electron, native, etc.)
- [x] WebView vs native rendering
- [x] Game asset loading in external process
- [x] Communication protocol design

## Research Findings

### 1. Cross-Platform Window Management

**Window Creation:**
- Electron provides consistent cross-platform window creation via `BrowserWindow`
- Supports Windows, macOS, and Linux with unified API
- Can spawn windows from Node.js child processes

**Window Features:**
- **Transparency**: Supported on all platforms with `transparent: true` option
- **Frameless windows**: Available with `frame: false`
- **Always-on-top**: Supported with `alwaysOnTop: true`
- **Window positioning**: Can set exact x,y coordinates
- **Click-through**: Possible with `setIgnoreMouseEvents(true)`

**Platform-specific considerations:**
- macOS: Special handling for dock icon behavior
- Windows: May need special handling for taskbar
- Linux: Window manager variations may affect behavior

### 2. Process Management

**Child Process Spawning:**
- VS Code extensions CAN spawn child processes using Node.js `child_process` module
- No restrictions on spawning external executables from extensions
- Can use `spawn`, `exec`, or `fork` methods

**Example approaches found:**
- q-masters/vscode-electron extension successfully spawns Electron instances
- Child Process Debugger extension demonstrates process attachment
- Open Terminal Programmatically shows external process launching

**Process Communication:**
- Can use standard IPC mechanisms (stdin/stdout)
- Electron supports MessagePort for efficient IPC
- Can establish bidirectional communication channels

### 3. Security and Permissions

**VS Code Extension Restrictions:**
- Extensions run in Node.js context with full system access
- Can spawn any external process
- No sandbox restrictions for spawned processes
- Main restriction: Cannot directly access Cursor's DOM or Electron APIs

**Electron Security:**
- Spawned Electron process runs independently
- Can disable web security if needed for local game files
- Context isolation can be disabled for game content
- No restrictions on file system access

### 4. Performance and Resources

**Memory Usage:**
- Electron process: ~50-100MB base overhead
- Additional memory depends on game complexity
- Can share resources between multiple game windows

**Performance Optimizations:**
- Hardware acceleration available by default
- Can use offscreen rendering if needed
- WebGL and Canvas 2D fully supported

### 5. User Experience

**Window Management:**
- Can save/restore window position and size
- Multi-monitor support built into Electron
- Can detect screen changes and adjust
- Native OS window snapping works automatically

**State Persistence:**
- Can use localStorage or IndexedDB in game window
- Extension can store window preferences
- Can restore exact window state on restart

### 6. Technical Implementation

**Recommended Approach:**
1. **Spawn Electron child process from extension**
   - Use Node.js `child_process.spawn()`
   - Pass game configuration as command line args or environment variables

2. **Communication Protocol:**
   - Use JSON-RPC over stdin/stdout for simple commands
   - Can upgrade to MessagePort for high-frequency updates
   - Events: show/hide, resize, position, game selection

3. **Game Loading:**
   - Electron window loads local HTML file
   - Games embedded as iframes or loaded directly
   - Full access to file system for game assets

**Code Architecture:**
```
Extension (VS Code)
  ├── Spawns Electron process
  ├── Manages window lifecycle
  └── Sends commands via IPC

Electron Process (Independent)
  ├── Creates BrowserWindow
  ├── Loads game content
  ├── Handles window events
  └── Communicates back to extension
```

## Implementation Plan

### Phase 1: Proof of Concept
1. Create minimal Electron app that can be spawned from extension
2. Implement basic IPC for show/hide commands
3. Test window positioning and transparency

### Phase 2: Game Integration
1. Load simple HTML5 games in Electron window
2. Implement game switching mechanism
3. Add window controls (resize, reposition, opacity)

### Phase 3: Polish
1. Add multi-window support
2. Implement state persistence
3. Create smooth animations and transitions
4. Add user preferences

## Advantages Over WebView Panel

1. **Complete UI Freedom**: No panel constraints
2. **True Floating Window**: Can position anywhere on screen
3. **Better Performance**: Direct hardware acceleration
4. **Richer Features**: Transparency, click-through, custom shapes
5. **OS Integration**: Native window behaviors

## Potential Challenges

1. **Distribution Size**: Need to bundle Electron (~50MB)
2. **Startup Time**: Electron process takes 1-2 seconds to start
3. **Resource Usage**: Each window is a full process
4. **Complexity**: More moving parts than WebView

## Conclusion

The external window approach is **technically feasible** and offers significant advantages over the WebView panel approach. All identified issues have viable solutions:

- ✅ Cross-platform window management is well-supported by Electron
- ✅ VS Code extensions can spawn and manage child processes
- ✅ No blocking security restrictions
- ✅ Performance is acceptable for mini-games
- ✅ Good user experience is achievable
- ✅ Clear implementation path

**Recommendation**: Proceed with external Electron window implementation as it provides the best user experience and most flexibility for the floating game window concept.

## Detailed Implementation Guide

### Step 1: Create Electron App Structure

Create a new directory `electron-game-window/` in the project with:

```
electron-game-window/
├── package.json
├── main.js           # Electron main process
├── preload.js        # Preload script for security
├── index.html        # Game container
└── games/            # Game files directory
```

**Key files to create:**

1. **electron-game-window/package.json**:
```json
{
  "name": "ritalin-game-window",
  "version": "1.0.0",
  "main": "main.js",
  "scripts": {
    "start": "electron ."
  },
  "dependencies": {
    "electron": "^27.0.0"
  }
}
```

2. **electron-game-window/main.js**:
```javascript
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 300,
    x: 0,  // Position at bottom-left
    y: process.platform === 'darwin' ? 0 : undefined,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Position at bottom-left of primary display
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  mainWindow.setPosition(0, height - 300);

  mainWindow.loadFile('index.html');
}

// IPC handlers for extension communication
ipcMain.on('show-window', () => mainWindow.show());
ipcMain.on('hide-window', () => mainWindow.hide());
ipcMain.on('load-game', (event, gamePath) => {
  mainWindow.webContents.send('load-game', gamePath);
});

// Handle stdin for IPC from extension
process.stdin.on('data', (data) => {
  try {
    const message = JSON.parse(data.toString());
    switch (message.command) {
      case 'show': mainWindow.show(); break;
      case 'hide': mainWindow.hide(); break;
      case 'loadGame': mainWindow.webContents.send('load-game', message.gamePath); break;
      case 'quit': app.quit(); break;
    }
  } catch (e) {
    console.error('Failed to parse IPC message:', e);
  }
});

app.whenReady().then(createWindow);
```

### Step 2: Extension Integration

**Update src/extension.ts** to add:

```typescript
import * as cp from 'child_process';
import * as path from 'path';

export class GameWindowManager {
    private electronProcess: cp.ChildProcess | null = null;
    private extensionPath: string;

    constructor(context: vscode.ExtensionContext) {
        this.extensionPath = context.extensionPath;
    }

    public async start(): Promise<void> {
        if (this.electronProcess) {
            return; // Already running
        }

        const electronPath = require('electron');
        const appPath = path.join(this.extensionPath, 'electron-game-window');
        
        this.electronProcess = cp.spawn(electronPath, [appPath], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        this.electronProcess.on('error', (err) => {
            console.error('Failed to start game window:', err);
            vscode.window.showErrorMessage('Failed to start game window');
        });

        this.electronProcess.on('exit', () => {
            this.electronProcess = null;
        });
    }

    public show(): void {
        this.sendCommand({ command: 'show' });
    }

    public hide(): void {
        this.sendCommand({ command: 'hide' });
    }

    public loadGame(gamePath: string): void {
        this.sendCommand({ command: 'loadGame', gamePath });
    }

    private sendCommand(message: any): void {
        if (this.electronProcess && this.electronProcess.stdin) {
            this.electronProcess.stdin.write(JSON.stringify(message) + '\n');
        }
    }

    public dispose(): void {
        if (this.electronProcess) {
            this.sendCommand({ command: 'quit' });
            this.electronProcess = null;
        }
    }
}
```

### Step 3: Build Process Integration

**Update package.json** scripts:

```json
{
  "scripts": {
    "vscode:prepublish": "npm run compile && npm run build-electron",
    "build-electron": "cd electron-game-window && npm install && npm run build",
    "package": "vsce package --no-dependencies"
  }
}
```

### Step 4: Simple Game Integration

Create **electron-game-window/index.html**:

```html
<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            margin: 0;
            padding: 0;
            background: rgba(0, 0, 0, 0.8);
            border-radius: 10px;
            overflow: hidden;
            -webkit-app-region: drag;
        }
        #game-container {
            width: 100%;
            height: 100%;
            -webkit-app-region: no-drag;
        }
        iframe {
            width: 100%;
            height: 100%;
            border: none;
        }
    </style>
</head>
<body>
    <div id="game-container">
        <!-- Game will be loaded here -->
    </div>
    <script>
        window.electronAPI.onLoadGame((gamePath) => {
            const container = document.getElementById('game-container');
            container.innerHTML = `<iframe src="${gamePath}" sandbox="allow-scripts allow-same-origin"></iframe>`;
        });
    </script>
</body>
</html>
```

### Step 5: Cursor AI Detection Integration

Connect to existing CursorDetector:

```typescript
// In extension.ts activate function
const gameWindowManager = new GameWindowManager(context);

cursorDetector.on('ai-generation-start', () => {
    gameWindowManager.start().then(() => {
        gameWindowManager.show();
        gameWindowManager.loadGame('path/to/simple-game.html');
    });
});

cursorDetector.on('ai-generation-end', () => {
    gameWindowManager.hide();
});
```

### Key Implementation Notes:

1. **Electron Bundling**: Use `electron-builder` or `electron-packager` to create platform-specific binaries
2. **Security**: Use context isolation and disable node integration in renderer
3. **Game Loading**: Start with simple HTML5 games, can expand to more complex ones
4. **Window Positioning**: Calculate based on screen dimensions, account for taskbar/dock
5. **Error Handling**: Gracefully handle Electron process crashes
6. **Performance**: Lazy-load Electron process only when needed
7. **Distribution**: Include pre-built Electron binaries for each platform

### Testing Checklist:

- [ ] Window appears in bottom-left corner
- [ ] Window stays on top of other windows
- [ ] Transparency works correctly
- [ ] Games load and are playable
- [ ] Window shows/hides based on AI activity
- [ ] Process cleanup on extension deactivation
- [ ] Cross-platform compatibility (Windows/Mac/Linux)

### Next Steps:

1. Implement basic proof of concept following Step 1
2. Test IPC communication between extension and Electron
3. Add simple HTML5 game (Snake or Tetris)
4. Integrate with CursorDetector events
5. Add user preferences for position/size/opacity
6. Package for distribution 