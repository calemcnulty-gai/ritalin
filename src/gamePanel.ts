import * as vscode from 'vscode';
import { GameManager, GameInfo } from './gameManager';

export class GamePanel {
    public static readonly viewType = 'ritalinGame';
    private _panel: vscode.WebviewPanel | undefined;
    private readonly _extensionUri: vscode.Uri;
    private readonly _context: vscode.ExtensionContext;
    private _disposables: vscode.Disposable[] = [];
    private _isInitialized = false;
    private _isVisible = false;
    private _currentGame: GameInfo | undefined;
    private _outputChannel: vscode.OutputChannel;

    constructor(extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
        this._extensionUri = extensionUri;
        this._context = context;
        this._outputChannel = vscode.window.createOutputChannel('Ritalin Debug');
        console.log('[Ritalin] GamePanel constructor called');
        
        // Don't create panel here - create it when game is loaded or preloaded
        // This ensures localResourceRoots are properly configured
    }

    public loadGame(gameInfo: GameInfo): void {
        console.log('[Ritalin] Loading game:', gameInfo.title);
        this._currentGame = gameInfo;
        
        // Recreate the panel with proper localResourceRoots for this game
        const wasVisible = this._isVisible;
        if (this._panel) {
            console.log('[Ritalin] Disposing existing panel to recreate with game resources');
            this._panel.dispose();
            this._panel = undefined;
        }
        
        this._createPanel();
        
        // Restore visibility if it was visible before
        if (wasVisible) {
            this._updateVisibility(true);
        }
    }

    public preload(gameInfo?: GameInfo): void {
        console.log('[Ritalin] === PRELOAD DEBUG ===');
        console.log('[Ritalin] Panel exists:', !!this._panel);
        console.log('[Ritalin] Panel initialized:', this._isInitialized);
        console.log('[Ritalin] Current game:', this._currentGame?.title || 'None');
        console.log('[Ritalin] Provided game:', gameInfo?.title || 'None');
        
        // Show the debug output channel
        this._outputChannel.show(true);
        this._outputChannel.appendLine('=== PRELOAD DEBUG SESSION ===');
        this._outputChannel.appendLine(`Panel exists: ${!!this._panel}`);
        this._outputChannel.appendLine(`Panel initialized: ${this._isInitialized}`);
        this._outputChannel.appendLine(`Current game: ${this._currentGame?.title || 'None'}`);
        this._outputChannel.appendLine(`Provided game: ${gameInfo?.title || 'None'}`);
        
        // Create panel if it doesn't exist
        if (!this._panel) {
            console.log('[Ritalin] Creating panel during preload...');
            this._outputChannel.appendLine('Creating panel during preload...');
            this._createPanel();
        }
        
        // Load game if provided
        if (gameInfo) {
            console.log('[Ritalin] Loading game during preload:', gameInfo.title);
            this._outputChannel.appendLine(`Loading game: ${gameInfo.title}`);
            this._outputChannel.appendLine(`Entry point: ${gameInfo.entryPoint}`);
            this._outputChannel.appendLine(`Is downloaded: ${gameInfo.isDownloaded}`);
            this.loadGame(gameInfo);
        } else if (this._currentGame) {
            console.log('[Ritalin] Refreshing current game HTML');
            this._outputChannel.appendLine('Refreshing current game HTML');
            if (this._panel) {
                this._panel.webview.html = this._getHtmlForWebview();
            }
        } else {
            console.log('[Ritalin] No game to preload');
            this._outputChannel.appendLine('No game to preload - showing instructions');
        }
        
        console.log('[Ritalin] Preload complete');
        this._outputChannel.appendLine('Preload complete');
    }

    private _createPanel(): void {
        console.log('[Ritalin] Creating game panel...');
        
        // Get the game storage directory for localResourceRoots using the same path as GameManager
        const gameStorageDir = vscode.Uri.file(
            require('path').join(this._context.globalStorageUri.fsPath, 'games')
        );
        
        // Also add the specific game directory if we have a current game
        const localResourceRoots = [
            this._extensionUri,
            vscode.Uri.joinPath(this._extensionUri, 'games'),
            gameStorageDir
        ];
        
        // If we have a current game, add its specific directory
        if (this._currentGame && this._currentGame.entryPoint) {
            const currentGameDir = vscode.Uri.file(require('path').dirname(this._currentGame.entryPoint));
            localResourceRoots.push(currentGameDir);
            console.log(`[Ritalin] Added game-specific directory to localResourceRoots: ${currentGameDir.fsPath}`);
            this._outputChannel.appendLine(`[RESOURCE] Added game directory: ${currentGameDir.fsPath}`);
        }
        
        console.log(`[Ritalin] Creating panel with ${localResourceRoots.length} localResourceRoots:`);
        localResourceRoots.forEach((root, index) => {
            console.log(`[Ritalin]   ${index}: ${root.fsPath}`);
            this._outputChannel.appendLine(`[RESOURCE] Root ${index}: ${root.fsPath}`);
        });
        
        // Create panel that stays in background
        this._panel = vscode.window.createWebviewPanel(
            GamePanel.viewType,
            'Ritalin Game',
            { viewColumn: vscode.ViewColumn.Two, preserveFocus: true },
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: localResourceRoots
            }
        );

        // Set up message handling
        this._panel.webview.onDidReceiveMessage(
            message => {
                console.log('[Ritalin] WebView message:', message);
                switch (message.command) {
                    case 'debug':
                        console.log('[Ritalin] Debug:', message.text);
                        this._outputChannel.appendLine(`[DEBUG] ${message.text}`);
                        break;
                    case 'error':
                        console.error('[Ritalin] WebView Error:', message.text);
                        this._outputChannel.appendLine(`[ERROR] ${message.text}`);
                        break;
                    case 'unityDebug':
                        // New message type for Unity-specific debugging
                        const logLevel = message.level || 'info';
                        const logText = `[UNITY-${logLevel.toUpperCase()}] ${message.text}`;
                        this._outputChannel.appendLine(logText);
                        if (logLevel === 'error') {
                            console.error('[Ritalin] Unity Error:', message.text);
                        } else {
                            console.log('[Ritalin] Unity Debug:', message.text);
                        }
                        break;
                    case 'gameLoaded':
                        console.log('[Ritalin] Game loaded successfully');
                        this._outputChannel.appendLine('[SUCCESS] Unity game loaded successfully!');
                        this._isInitialized = true;
                        break;
                    case 'show':
                        this._updateVisibility(true);
                        break;
                    case 'hide':
                        this._updateVisibility(false);
                        break;
                }
            },
            null,
            this._disposables
        );

        // Load the initial HTML
        this._panel.webview.html = this._getHtmlForWebview();
        
        // Start hidden
        this._isVisible = false;
        
        this._panel.onDidDispose(() => this._dispose(), null, this._disposables);
    }

    private _updateVisibility(visible: boolean): void {
        if (this._panel) {
            this._panel.webview.postMessage({ 
                command: 'setVisibility', 
                visible: visible 
            });
            this._isVisible = visible;
            
            if (visible) {
                // Bring panel to foreground when showing
                const column = vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.Two;
                this._panel.reveal(column, false);
            }
        }
    }

    public show(): void {
        console.log('[Ritalin] GamePanel.show() called');
        
        // Show the debug output channel when showing the game
        this._outputChannel.show(true);
        
        if (!this._panel) {
            console.error('[Ritalin] Panel not preloaded!');
            this._createPanel();
            return;
        }

        this._updateVisibility(true);
        console.log('[Ritalin] Game panel shown');
    }

    public hide(): void {
        console.log('[Ritalin] GamePanel.hide() called');
        this._updateVisibility(false);
        console.log('[Ritalin] Game panel hidden');
    }

    public toggle(): void {
        if (this._isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    public dispose(): void {
        this._dispose();
    }

    private _dispose(): void {
        console.log('[Ritalin] GamePanel disposing...');
        
        this._outputChannel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
        
        if (this._panel) {
            this._panel.dispose();
            this._panel = undefined;
        }
    }

    private _getHtmlForWebview(): string {
        if (!this._currentGame || !this._currentGame.isDownloaded || !this._currentGame.entryPoint) {
            return this._getNoGameSelectedHtml();
        }

        return this._getGameHtml(this._currentGame);
    }

    private _getGameHtml(gameInfo: GameInfo): string {
        const gameUri = this._panel!.webview.asWebviewUri(vscode.Uri.file(gameInfo.entryPoint!));
        
        // Read the game's HTML content and embed it directly
        const fs = require('fs');
        let gameHtmlContent = '';
        
        try {
            gameHtmlContent = fs.readFileSync(gameInfo.entryPoint!, 'utf8');
        } catch (error) {
            console.error('[Ritalin] Failed to read game HTML:', error);
            return this._getGameErrorHtml(gameInfo, error);
        }
        
        // Extract the game's HTML content and modify resource paths
        const gameDir = require('path').dirname(gameInfo.entryPoint!);
        const gameDirUri = this._panel!.webview.asWebviewUri(vscode.Uri.file(gameDir));
        
        // Debug: List files in game directory
        try {
            const files = fs.readdirSync(gameDir);
            console.log(`[Ritalin] Game directory: ${gameDir}`);
            console.log(`[Ritalin] Files found: ${files.join(', ')}`);
            this._outputChannel.appendLine(`Game directory: ${gameDir}`);
            this._outputChannel.appendLine(`Files found: ${files.join(', ')}`);
        } catch (err) {
            console.error(`[Ritalin] Error reading game directory: ${err}`);
            this._outputChannel.appendLine(`Error reading game directory: ${err}`);
        }
        
        // Replace relative paths in the game HTML with webview URIs
        gameHtmlContent = gameHtmlContent.replace(
            /src="([^"]+)"/g, 
            (match, path) => {
                if (path.startsWith('http')) {
                    return match; // Keep absolute URLs
                }
                
                // Handle URL-encoded paths and special characters
                const decodedPath = decodeURIComponent(path);
                const fullPath = require('path').resolve(gameDir, decodedPath);
                
                console.log(`[Ritalin] Processing src path: "${path}" -> decoded: "${decodedPath}" -> full: "${fullPath}"`);
                
                // Check if file exists before creating URI
                if (!require('fs').existsSync(fullPath)) {
                    console.warn(`[Ritalin] File not found: ${fullPath}`);
                    this._outputChannel.appendLine(`[WARNING] File not found: ${fullPath}`);
                    return match; // Keep original if file doesn't exist
                }
                
                try {
                    const webviewUri = this._panel!.webview.asWebviewUri(vscode.Uri.file(fullPath));
                    console.log(`[Ritalin] Mapped "${path}" -> "${webviewUri.toString()}"`);
                    this._outputChannel.appendLine(`[RESOURCE] Mapped "${path}" -> "${webviewUri.toString()}"`);
                    return `src="${webviewUri}"`;
                } catch (error) {
                    console.error(`[Ritalin] Failed to create webview URI for ${fullPath}:`, error);
                    this._outputChannel.appendLine(`[ERROR] Failed to create webview URI for ${fullPath}: ${error}`);
                    return match; // Keep original on error
                }
            }
        );
        
        // Replace dataUrl, frameworkUrl, codeUrl in Unity config objects
        gameHtmlContent = gameHtmlContent.replace(
            /(dataUrl|frameworkUrl|codeUrl):\s*["']([^"']+)["']/g,
            (match, configKey, path) => {
                if (path.startsWith('http')) {
                    return match; // Keep absolute URLs
                }
                
                const decodedPath = decodeURIComponent(path);
                const fullPath = require('path').resolve(gameDir, decodedPath);
                
                console.log(`[Ritalin] Processing Unity config ${configKey}: "${path}" -> decoded: "${decodedPath}" -> full: "${fullPath}"`);
                
                // Check if file exists before creating URI
                if (!require('fs').existsSync(fullPath)) {
                    console.warn(`[Ritalin] Unity file not found: ${fullPath}`);
                    this._outputChannel.appendLine(`[WARNING] Unity file not found: ${fullPath}`);
                    return match; // Keep original if file doesn't exist
                }
                
                try {
                    const webviewUri = this._panel!.webview.asWebviewUri(vscode.Uri.file(fullPath));
                    console.log(`[Ritalin] Mapped Unity ${configKey} "${path}" -> "${webviewUri.toString()}"`);
                    this._outputChannel.appendLine(`[UNITY] Mapped ${configKey} "${path}" -> "${webviewUri.toString()}"`);
                    return `${configKey}: "${webviewUri}"`;
                } catch (error) {
                    console.error(`[Ritalin] Failed to create webview URI for Unity file ${fullPath}:`, error);
                    this._outputChannel.appendLine(`[ERROR] Failed to create webview URI for Unity file ${fullPath}: ${error}`);
                    return match; // Keep original on error
                }
            }
        );
        
        // Inject our debug overlay and VS Code API integration
        const debugOverlay = `
            <div class="ritalin-debug-overlay" id="ritalinDebug" style="
                position: fixed;
                top: 10px;
                left: 10px;
                background: rgba(0, 0, 0, 0.8);
                color: #0f0;
                padding: 10px;
                font-family: monospace;
                font-size: 12px;
                border-radius: 5px;
                z-index: 10000;
                max-width: 300px;
                max-height: 200px;
                overflow-y: auto;
            ">
                <div>🎮 Ritalin Debug</div>
                <div>Game: ${gameInfo.title}</div>
                <div id="debugStatus">Status: Loading...</div>
                <div id="debugLogs"></div>
            </div>
        `;
        
        // Audio Overlay Disabled - HTML Definition is now an empty string
        const audioOverlayHtml = ``; 
        
        const ritalinScript = `
            <script>
                // Ritalin VS Code integration
                let vscode;
                let debugElement, debugStatus, debugLogs;
                // let audioOverlayElement; // Audio Overlay Disabled - Variable Declaration
                
                // Check if VS Code API is already available globally
                if (window.acquireVsCodeApi && !window.ritalinVsCodeApi) {
                    try {
                        vscode = acquireVsCodeApi();
                        window.ritalinVsCodeApi = vscode; // Store globally to prevent re-acquisition
                        console.log('[Ritalin] VS Code API acquired successfully');
                    } catch (e) {
                        console.log('[Ritalin] VS Code API already acquired, using existing instance');
                        vscode = window.ritalinVsCodeApi;
                    }
                } else if (window.ritalinVsCodeApi) {
                    vscode = window.ritalinVsCodeApi;
                    console.log('[Ritalin] Using existing VS Code API instance');
                } else {
                    console.log('[Ritalin] No VS Code API available');
                }
                
                // Override the global acquireVsCodeApi function to prevent other scripts from acquiring it
                if (window.acquireVsCodeApi && vscode) {
                    const originalAcquire = window.acquireVsCodeApi;
                    window.acquireVsCodeApi = function() {
                        console.log('[Ritalin] Preventing duplicate VS Code API acquisition');
                        return vscode;
                    };
                }
                
                function addDebugLog(message, level = 'info') {
                    const timestamp = new Date().toLocaleTimeString();
                    const logEntry = '[' + timestamp + '] ' + message;
                    console.log('[Ritalin]', message);
                    
                    if (vscode) {
                        try {
                            vscode.postMessage({ 
                                command: 'unityDebug', 
                                text: logEntry, 
                                level: level 
                            });
                        } catch (e) {
                            console.error('Failed to send debug message to VS Code:', e);
                        }
                    }
                    
                    if (debugLogs) {
                        const logElement = document.createElement('div');
                        logElement.className = 'debug-entry';
                        logElement.textContent = logEntry;
                        logElement.style.color = level === 'error' ? '#f44' : (level === 'warn' ? '#fa0' : '#0f0');
                        debugLogs.appendChild(logElement);
                        
                        while (debugLogs.children.length > 15) {
                            debugLogs.removeChild(debugLogs.firstChild);
                        }
                        debugLogs.scrollTop = debugLogs.scrollHeight;
                    }
                }
                
                function updateStatus(status) {
                    if (debugStatus) {
                        debugStatus.textContent = 'Status: ' + status;
                    }
                    addDebugLog('Status: ' + status);
                }
                
                function onUnityError(message) {
                    addDebugLog('Unity Error: ' + message, 'error');
                    updateStatus('Unity Error');
                }
                
                function onFrameLoaded() {
                    addDebugLog('Running in VS Code WebView');
                    addDebugLog('Script initialized, waiting for page load...');
                    
                    setTimeout(() => {
                        addDebugLog('Page loaded. RitalinScript active.');
                    }, 100);
                }
                
                window.addEventListener('DOMContentLoaded', function() {
                    debugElement = document.getElementById('ritalinDebug');
                    debugStatus = document.getElementById('debugStatus');
                    debugLogs = document.getElementById('debugLogs');
                    // audioOverlayElement = document.getElementById('ritalinAudioOverlay'); // Audio Overlay Disabled - Get Element
                    
                    // // Audio Overlay Disabled - Event Listener Logic (using // for each line)
                    // if (audioOverlayElement) {
                    //     addDebugLog('Audio overlay element found. Initial display: ' + audioOverlayElement.style.display);
                    //     audioOverlayElement.addEventListener('click', function() {
                    //         if (audioOverlayElement) { 
                    //             audioOverlayElement.style.display = 'none';
                    //         }
                    //         addDebugLog('Audio overlay clicked, game should start with audio if supported.');
                    //         const gameCanvas = document.getElementById('unity-canvas');
                    //         if (gameCanvas) {
                    //             gameCanvas.focus();
                    //         }
                    //     });
                    // } else {
                    //     addDebugLog('Audio overlay element not found!', 'warn');
                    // }

                    addDebugLog('Game loaded directly in WebView (no iframe)');
                    updateStatus('Initializing Unity...');
                    
                    setTimeout(() => {
                        if (debugElement) {
                            debugElement.style.display = 'none';
                        }
                    }, 30000);
                    
                    onFrameLoaded();
                });
                
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'setVisibility':
                            const gameContainer = document.getElementById('gameContainer'); 
                            const unityCanvas = document.getElementById('unity-canvas');
                            
                            if (message.visible) {
                                document.body.style.display = 'block'; 
                                if (unityCanvas) unityCanvas.style.display = 'block'; 
                                if (gameContainer) gameContainer.style.display = 'block';
                                addDebugLog('Game shown.');
                            } else {
                                document.body.style.display = 'none'; 
                                addDebugLog('Game hidden');
                            }
                            break;
                    }
                });
                
                window.addEventListener('error', function(event) {
                    addDebugLog('Global error: ' + (event.error ? event.error.message : event.message), 'error');
                });
                
                window.addEventListener('unhandledrejection', function(event) {
                    addDebugLog('Unhandled rejection: ' + event.reason, 'error');
                });
                
                addDebugLog('Waiting for show command (body initially visible).');
            </script>
        `;
        
        // Insert our debug overlay and script into the game's HTML
        const bodyCloseIndex = gameHtmlContent.lastIndexOf('</body>');
        if (bodyCloseIndex !== -1) {
            gameHtmlContent = 
                gameHtmlContent.substring(0, bodyCloseIndex) +
                debugOverlay +
                audioOverlayHtml +
                ritalinScript +
                gameHtmlContent.substring(bodyCloseIndex);
        } else {
            // If no body tag found, append to end
            gameHtmlContent += debugOverlay + audioOverlayHtml + ritalinScript;
        }
        
        // Update CSP to allow our resources
        const cspPattern = /<meta\\s+http-equiv=["']Content-Security-Policy["'][^>]*>/i;
        const newCSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'self' ${this._panel!.webview.cspSource} 'unsafe-inline' 'unsafe-eval' data: blob:; script-src 'self' ${this._panel!.webview.cspSource} 'unsafe-inline' 'unsafe-eval'; style-src 'self' ${this._panel!.webview.cspSource} 'unsafe-inline'; img-src 'self' ${this._panel!.webview.cspSource} data: blob:; connect-src 'self' ${this._panel!.webview.cspSource} blob:; worker-src 'self' ${this._panel!.webview.cspSource} blob:;">`;
        
        if (cspPattern.test(gameHtmlContent)) {
            gameHtmlContent = gameHtmlContent.replace(cspPattern, newCSP);
        } else {
            // If no CSP found, add one to the head
            const headPattern = /<head[^>]*>/i;
            if (headPattern.test(gameHtmlContent)) {
                gameHtmlContent = gameHtmlContent.replace(headPattern, '$&\n' + newCSP);
            }
        }
        
        return gameHtmlContent;
    }

    private _getGameErrorHtml(gameInfo: GameInfo, error: any): string {
        return `<!DOCTYPE html>
        <html lang="en-us">
        <head>
            <meta charset="utf-8">
            <title>Ritalin - Error Loading Game</title>
            <style>
                body {
                    background: #000;
                    color: #fff;
                    font-family: Arial, sans-serif;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    padding: 20px;
                    box-sizing: border-box;
                }
                .error-container {
                    text-align: center;
                    max-width: 600px;
                }
                h2 { color: #f44; }
                .error-details {
                    background: #1e1e1e;
                    border: 1px solid #444;
                    border-radius: 5px;
                    padding: 15px;
                    margin: 20px 0;
                    text-align: left;
                    font-family: monospace;
                    font-size: 12px;
                    color: #ccc;
                }
            </style>
        </head>
        <body>
            <div class="error-container">
                <h2>❌ Failed to Load Game</h2>
                <p>Could not load <strong>${gameInfo.title}</strong></p>
                
                <div class="error-details">
                    <strong>Error:</strong> ${error.message || error}<br>
                    <strong>Entry Point:</strong> ${gameInfo.entryPoint}<br>
                    <strong>Game Downloaded:</strong> ${gameInfo.isDownloaded}
                </div>
                
                <p>Try re-downloading the game or selecting a different one.</p>
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                vscode.postMessage({ 
                    command: 'unityDebug', 
                    text: 'Game load error: ${error.message || error}', 
                    level: 'error' 
                });
            </script>
        </body>
        </html>`;
    }

    private _getNoGameSelectedHtml(): string {
        return `<!DOCTYPE html>
        <html lang="en-us">
        <head>
            <meta charset="utf-8">
            <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
            <title>Ritalin - No Game Selected</title>
            <style>
                html, body {
                    background: #000000;
                    width: 100%;
                    height: 100%;
                    overflow: hidden;
                    padding: 0;
                    margin: 0;
                    font-family: Arial, sans-serif;
                    color: #ffffff;
                }
                
                .message {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    text-align: center;
                    padding: 20px;
                    box-sizing: border-box;
                }
                
                h2 {
                    margin: 20px 0;
                    color: #4CAF50;
                }
                
                p {
                    margin: 10px 0;
                    color: #cccccc;
                    line-height: 1.5;
                }
                
                .instructions {
                    background: #1e1e1e;
                    border: 1px solid #333;
                    border-radius: 8px;
                    padding: 20px;
                    margin: 20px 0;
                    max-width: 500px;
                }
                
                .step {
                    margin: 10px 0;
                    padding-left: 20px;
                    position: relative;
                }
                
                .step:before {
                    content: '•';
                    position: absolute;
                    left: 0;
                    color: #4CAF50;
                    font-weight: bold;
                }
                
                code {
                    background: #2d2d2d;
                    color: #4CAF50;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-family: 'Monaco', 'Menlo', monospace;
                }

                /* Visibility control */
                body.hidden {
                    display: none !important;
                }
            </style>
        </head>
        <body>
            <div class="message">
                <h2>🎮 Ritalin Game Extension</h2>
                <p>No game selected yet!</p>
                
                <div class="instructions">
                    <p><strong>To get started:</strong></p>
                    <div class="step">Open Command Palette <code>Cmd+Shift+P</code></div>
                    <div class="step">Search for <code>Ritalin: Search itch.io Games</code></div>
                    <div class="step">Find and download a Unity WebGL game</div>
                    <div class="step">Game will automatically show during AI generation!</div>
                </div>
                
                <p style="font-size: 12px; margin-top: 30px; opacity: 0.7;">
                    Games are downloaded locally and run offline.<br>
                    No data is sent to external servers during gameplay.
                </p>
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                // Handle messages from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'setVisibility':
                            if (message.visible) {
                                document.body.classList.remove('hidden');
                            } else {
                                document.body.classList.add('hidden');
                            }
                            break;
                    }
                });

                // Start in hidden state
                document.body.classList.add('hidden');
            </script>
        </body>
        </html>`;
    }
} 