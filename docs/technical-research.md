# Technical Research - Ritalin for Cursor

## VS Code WebView Capabilities

### Basic WebView Features
- **WebView Panel**: Can create panels in editor, sidebar, or as separate windows
- **Content Security Policy**: Strict by default, but configurable
- **Message Passing**: Two-way communication between extension and WebView
- **Resource Loading**: Can load local resources or remote URLs (with restrictions)
- **State Persistence**: WebView state can be saved/restored

### WebView Panel Options
```typescript
// Create in editor area (like a code tab)
const panel = vscode.window.createWebviewPanel(
    'gameView',
    'Ritalin Game',
    vscode.ViewColumn.Two, // Opens beside active editor
    {
        enableScripts: true,
        retainContextWhenHidden: true // Keeps WebView alive when hidden
    }
);

// Create as floating panel (requires VS Code 1.50+)
// Note: True floating windows not directly supported, but can use:
// - ViewColumn.Beside
// - Custom panel decorations
// - CSS positioning within WebView
```

### Key Limitations
1. **No true floating windows** - WebViews are confined to VS Code's panel system
2. **CORS restrictions** - Can't directly load cross-origin iframes without proper headers
3. **CSP restrictions** - Content Security Policy blocks inline scripts by default

### Workarounds for Game Embedding

#### Option 1: Proxy Approach
```typescript
// Extension acts as proxy to serve game content
const gameUrl = 'https://alarts.itch.io/die-in-the-dungeon';
const proxyUrl = panel.webview.asWebviewUri(vscode.Uri.parse(gameUrl));
```

#### Option 2: iframe with CSP Configuration
```typescript
panel.webview.html = `
    <meta http-equiv="Content-Security-Policy" content="
        default-src 'none';
        frame-src https://itch.io https://*.itch.io;
        style-src ${webview.cspSource} 'unsafe-inline';
        script-src ${webview.cspSource};
    ">
    <iframe src="https://alarts.itch.io/die-in-the-dungeon" 
            width="100%" height="100%"
            frameborder="0">
    </iframe>
`;
```

## Cursor AI Detection Methods

### Approach 1: DOM Monitoring (Most Promising)
```typescript
// Monitor for Cursor-specific UI elements
const observer = new MutationObserver((mutations) => {
    // Look for loading indicators in chat panel
    const chatPanel = document.querySelector('[data-test-id="chat-panel"]');
    const isGenerating = chatPanel?.querySelector('.loading-indicator');
});
```

### Approach 2: Extension Context Monitoring
```typescript
// Listen for active text editor changes
vscode.window.onDidChangeActiveTextEditor((editor) => {
    // Check if AI is modifying the document
});

// Monitor document changes
vscode.workspace.onDidChangeTextDocument((event) => {
    // Detect AI-generated changes by pattern/speed
});
```

### Approach 3: Command Interception
```typescript
// Override or wrap Cursor commands
const originalCommand = vscode.commands.getCommand('cursor.generateCode');
vscode.commands.registerCommand('cursor.generateCode', async (...args) => {
    // Show game
    await showGamePanel();
    // Execute original command
    const result = await originalCommand(...args);
    // Hide game
    await hideGamePanel();
    return result;
});
```

## itch.io Embedding Research

### Official itch.io Widget
```html
<iframe frameborder="0" 
        src="https://itch.io/embed/1474781?dark=true" 
        width="552" height="167">
</iframe>
```

### Direct Game Embed
- itch.io games can be embedded if the developer enables it
- "Die in the Dungeon" appears to have embedding enabled
- URL pattern: `https://v6p9d9t4.ssl.hwcdn.net/html/[game-id]/index.html`

### CORS Considerations
- itch.io sets `X-Frame-Options: SAMEORIGIN` on some content
- Game CDN (hwcdn.net) may have more permissive headers
- Need to test actual embedding behavior

## Next Steps
1. Create minimal VS Code extension to test WebView
2. Attempt to embed itch.io game in WebView
3. Test detection methods with actual Cursor instance
4. Evaluate performance and user experience 