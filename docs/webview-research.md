# VS Code WebView API Research

## Executive Summary

The VS Code WebView API allows extensions to create fully customizable views using HTML/CSS/JavaScript. WebViews are isolated, sandboxed environments that communicate with the extension via message passing. This research explores the capabilities, limitations, and implementation strategies for displaying mini-games during Cursor AI generation.

## Key Findings

### 1. WebView Capabilities

#### Core Features
- **HTML Rendering**: Full HTML5 support with customizable content
- **Script Execution**: JavaScript can be enabled with `enableScripts: true`
- **Message Passing**: Bidirectional communication between extension and WebView
- **State Persistence**: Using `getState`/`setState` for saving game state
- **Resource Loading**: Local resources via `asWebviewUri()` method
- **Theming**: CSS variables for VS Code theme integration

#### Lifecycle Management
- WebViews are created with `vscode.window.createWebviewPanel()`
- Content persists when hidden (with `retainContextWhenHidden: true`)
- Automatic disposal when closed by user
- Can be programmatically shown/hidden

### 2. Security Model

#### Content Security Policy (CSP)
- WebViews run in isolated contexts
- Default CSP is restrictive: `default-src 'none'`
- Must explicitly allow required resources:
  ```html
  <meta http-equiv="Content-Security-Policy" 
        content="default-src 'none'; 
                 img-src ${webview.cspSource} https:; 
                 script-src ${webview.cspSource}; 
                 style-src ${webview.cspSource};
                 frame-src https://itch.io https://*.itch.zone;">
  ```

#### Isolation
- WebViews cannot access VS Code APIs directly
- Cannot access local file system without permission
- Sandboxed from other WebViews
- No access to parent window DOM

### 3. iframe Embedding Limitations

#### CORS Issues
- External sites must include proper CORS headers
- `Cross-Origin-Resource-Policy` required for embedding
- Many sites (including itch.io) may block iframe embedding
- No way to bypass CORS from extension side

#### Workarounds for itch.io Games
1. **Direct iframe approach** (may fail due to CORS):
   ```html
   <iframe src="https://itch.io/embed/gameId" 
           width="100%" height="600"
           sandbox="allow-scripts allow-same-origin">
   </iframe>
   ```

2. **Alternative approaches**:
   - Host game files locally within extension
   - Use itch.io's embed API if available
   - Create a proxy server (complex, not recommended)
   - Package game as local HTML/JS files

### 4. Implementation Architecture

#### Recommended Structure
```
extension/
├── src/
│   ├── extension.ts      # Main extension entry
│   ├── webview/
│   │   ├── GamePanel.ts  # WebView management
│   │   └── gameLoader.ts # Game loading logic
├── media/
│   ├── games/           # Local game files
│   └── styles/          # WebView styles
└── package.json
```

#### Message Flow
```
Extension <-> WebView <-> Game iframe
    |            |            |
    |--Command-->|            |
    |            |--Load----->|
    |<--State----|            |
    |            |<--Events---|
```

### 5. State Management

#### Game State Persistence
```javascript
// In WebView
const vscode = acquireVsCodeApi();
// Save state
vscode.setState({ 
  gameProgress: currentLevel,
  score: playerScore 
});
// Restore state
const previousState = vscode.getState();
```

#### Extension State
- Use `context.workspaceState` for persistence
- Track game sessions and statistics
- Restore game window position/size

### 6. Performance Considerations

#### Memory Management
- `retainContextWhenHidden: true` increases memory usage
- Consider disposing WebView when not needed
- Limit number of concurrent WebViews

#### Loading Optimization
- Lazy load game resources
- Use local resources when possible
- Minimize initial WebView HTML size

## Implementation Recommendations

### 1. Hybrid Approach
Given CORS limitations with itch.io:
- Start with locally hosted games
- Provide option to load custom game URLs
- Cache game files locally when possible

### 2. Game Selection Strategy
- Bundle 2-3 lightweight HTML5 games
- Games should be:
  - Self-contained (single HTML file ideal)
  - Pausable/resumable
  - Quick to load (<1MB)
  - No external dependencies

### 3. WebView Configuration
```typescript
const panel = vscode.window.createWebviewPanel(
  'ritalnGame',
  'Focus Game',
  vscode.ViewColumn.Two,
  {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: [
      vscode.Uri.joinPath(context.extensionUri, 'media')
    ]
  }
);
```

### 4. Security Best Practices
- Validate all message data
- Sanitize any user input
- Use strict CSP policies
- Limit resource access paths

## Technical Challenges & Solutions

### Challenge 1: CORS Restrictions
**Problem**: itch.io and similar sites block iframe embedding
**Solution**: 
- Package games locally
- Use games with permissive embedding
- Consider WebGL/Canvas games that can be bundled

### Challenge 2: Detection of AI Generation
**Problem**: No direct API to detect Cursor AI generation
**Solution**:
- Monitor DOM changes in editor
- Watch for specific UI elements
- Use workspace events as proxy signals

### Challenge 3: Game State During Generation
**Problem**: Maintaining game state across show/hide cycles
**Solution**:
- Use `retainContextWhenHidden`
- Implement robust state serialization
- Auto-pause when hidden

## Proof of Concept Code

```typescript
// Basic WebView game loader
export class GamePanel {
  private static currentPanel: GamePanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._update();
    
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    
    this._panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'gameStateUpdate':
            this._saveGameState(message.state);
            break;
        }
      },
      null,
      this._disposables
    );
  }
  
  private _getHtmlForWebview(webview: vscode.Webview) {
    const gameUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'games', 'index.html')
    );
    
    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" 
              content="default-src 'none'; 
                       img-src ${webview.cspSource} https:; 
                       script-src ${webview.cspSource} 'unsafe-inline'; 
                       style-src ${webview.cspSource} 'unsafe-inline';">
        <title>Focus Game</title>
      </head>
      <body>
        <iframe id="gameFrame" 
                src="${gameUri}" 
                width="100%" 
                height="100%"
                style="border: none;">
        </iframe>
        <script>
          const vscode = acquireVsCodeApi();
          // Game communication logic here
        </script>
      </body>
      </html>`;
  }
}
```

## Next Steps

1. **Test iframe embedding** with various game hosting services
2. **Identify suitable games** that can be bundled locally
3. **Implement detection mechanism** for Cursor AI generation
4. **Create prototype** with basic game loading
5. **Test performance** and memory usage
6. **Iterate on UX** based on testing

## Resources

- [VS Code WebView API Documentation](https://code.visualstudio.com/api/extension-guides/webview)
- [WebView Security Best Practices](https://code.visualstudio.com/api/extension-guides/webview#security)
- [WebView Sample Extension](https://github.com/Microsoft/vscode-extension-samples/tree/main/webview-sample)
- [Content Security Policy Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) 