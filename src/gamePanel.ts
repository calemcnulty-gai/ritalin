import * as vscode from 'vscode';

export class GamePanel {
    public static readonly viewType = 'ritalinGame';
    private _panel: vscode.WebviewPanel | undefined;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    constructor(extensionUri: vscode.Uri) {
        this._extensionUri = extensionUri;
        console.log('[Ritalin] GamePanel constructor called');
    }

    public show(): void {
        console.log('[Ritalin] GamePanel.show() called');
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (this._panel) {
            console.log('[Ritalin] Panel already exists, revealing');
            this._panel.reveal(column);
            return;
        }

        console.log('[Ritalin] Creating new webview panel');
        // Create new panel
        this._panel = vscode.window.createWebviewPanel(
            GamePanel.viewType,
            'Ritalin Game',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    this._extensionUri,
                    vscode.Uri.joinPath(this._extensionUri, 'games'),
                    vscode.Uri.joinPath(this._extensionUri, 'games', 'die-in-the-dungeon'),
                    vscode.Uri.joinPath(this._extensionUri, 'games', 'die-in-the-dungeon', 'Build'),
                    vscode.Uri.joinPath(this._extensionUri, 'games', 'die-in-the-dungeon', 'StreamingAssets')
                ]
            }
        );

        // Set up message handling for debugging
        this._panel.webview.onDidReceiveMessage(
            message => {
                console.log('[Ritalin] WebView message:', message);
                switch (message.command) {
                    case 'debug':
                        console.log('[Ritalin] Debug:', message.text);
                        break;
                    case 'error':
                        console.error('[Ritalin] WebView Error:', message.text);
                        vscode.window.showErrorMessage(`Ritalin Game Error: ${message.text}`);
                        break;
                    case 'gameLoaded':
                        console.log('[Ritalin] Game loaded successfully');
                        break;
                }
            },
            null,
            this._disposables
        );

        // Set the HTML content
        const html = this._getHtmlForWebview();
        console.log('[Ritalin] Setting webview HTML');
        this._panel.webview.html = html;

        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this._dispose(), null, this._disposables);
    }

    public hide(): void {
        if (this._panel) {
            this._panel.dispose();
        }
    }

    public toggle(): void {
        if (this._panel) {
            this.hide();
        } else {
            this.show();
        }
    }

    public dispose(): void {
        this._dispose();
    }

    private _dispose(): void {
        if (this._panel) {
            this._panel.dispose();
            this._panel = undefined;
        }

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    private _getHtmlForWebview(): string {
        const config = vscode.workspace.getConfiguration('ritalin');
        const width = config.get<number>('windowWidth', 800);
        const height = config.get<number>('windowHeight', 600);

        // Get WebView URIs for Unity WebGL build files
        const gameDir = vscode.Uri.joinPath(this._extensionUri, 'games', 'die-in-the-dungeon');
        const buildDir = vscode.Uri.joinPath(gameDir, 'Build');
        
        const loaderUrl = this._panel?.webview.asWebviewUri(
            vscode.Uri.joinPath(buildDir, 'Die in the Dungeon 1.6.2f [WEB].loader.js')
        );
        const dataUrl = this._panel?.webview.asWebviewUri(
            vscode.Uri.joinPath(buildDir, 'Die in the Dungeon 1.6.2f [WEB].data.gz')
        );
        const frameworkUrl = this._panel?.webview.asWebviewUri(
            vscode.Uri.joinPath(buildDir, 'Die in the Dungeon 1.6.2f [WEB].framework.js.gz')
        );
        const wasmUrl = this._panel?.webview.asWebviewUri(
            vscode.Uri.joinPath(buildDir, 'Die in the Dungeon 1.6.2f [WEB].wasm.gz')
        );

        console.log('[Ritalin] Unity URLs:');
        console.log('[Ritalin] Loader:', loaderUrl?.toString());
        console.log('[Ritalin] Data:', dataUrl?.toString());
        console.log('[Ritalin] Framework:', frameworkUrl?.toString());
        console.log('[Ritalin] WASM:', wasmUrl?.toString());

        return `<!DOCTYPE html>
        <html lang="en-us">
        <head>
            <meta charset="utf-8">
            <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
            <title>Ritalin Game - Die in the Dungeon</title>
            <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https://*.vscode-cdn.net vscode-resource:; img-src 'self' data: blob: https://*.vscode-cdn.net vscode-resource:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.vscode-cdn.net vscode-resource:;">
            <style>
                html, body {
                    background: #000000;
                    width: 100%;
                    height: 100%;
                    overflow: hidden;
                    padding: 0;
                    margin: 0;
                    font-family: Arial, sans-serif;
                }
                
                div#gameContainer {
                    background: transparent !important;
                    position: absolute;
                }
                
                div#gameContainer canvas {
                    position: absolute;
                }
                
                div#gameContainer canvas[data-pixel-art="true"] {
                    position: absolute;
                    image-rendering: optimizeSpeed;
                    image-rendering: -webkit-crisp-edges;
                    image-rendering: -moz-crisp-edges;
                    image-rendering: -o-crisp-edges;
                    image-rendering: crisp-edges;
                    image-rendering: -webkit-optimize-contrast;
                    image-rendering: optimize-contrast;
                    image-rendering: pixelated;
                    -ms-interpolation-mode: nearest-neighbor;
                }

                .loading, .error, .debug {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    color: #666;
                    padding: 20px;
                    box-sizing: border-box;
                }
                .error {
                    color: #d73a49;
                }
                .debug {
                    font-family: monospace;
                    font-size: 12px;
                    text-align: left;
                    max-height: 80vh;
                    overflow-y: auto;
                }
                button {
                    margin: 10px;
                    padding: 10px 20px;
                    cursor: pointer;
                }
                .unity-progress {
                    background: #333;
                    border-radius: 4px;
                    overflow: hidden;
                    margin: 10px 0;
                    width: 300px;
                    height: 20px;
                }
                .unity-progress-bar {
                    background: linear-gradient(90deg, #4CAF50, #45a049);
                    height: 100%;
                    width: 0%;
                    transition: width 0.3s ease;
                }
            </style>
        </head>
        <body>
            <div class="loading" id="loading">
                <p>Loading Ritalin Game...</p>
                <p style="font-size: 14px;">Die in the Dungeon</p>
                <div class="unity-progress">
                    <div class="unity-progress-bar" id="progressBar"></div>
                </div>
                <p id="loadingText" style="font-size: 12px;">Initializing Unity...</p>
                <button onclick="showDebugInfo()">Show Debug Info</button>
            </div>
            
            <div class="error" id="error" style="display: none;">
                <h3>Game Loading Failed</h3>
                <p id="errorMessage">The Unity WebGL game failed to load.</p>
                <ul style="text-align: left;">
                    <li>Unity WebAssembly loading issue</li>
                    <li>Missing Unity build files</li>
                    <li>WebView security restrictions</li>
                </ul>
                <button onclick="retryLoad()">Retry</button>
                <button onclick="showDebugInfo()">Debug Info</button>
            </div>

            <div class="debug" id="debug" style="display: none;">
                <h3>Debug Information</h3>
                <p><strong>Extension URI:</strong> ${this._extensionUri.toString()}</p>
                <p><strong>Game Directory:</strong> ${gameDir.toString()}</p>
                <p><strong>Build Directory:</strong> ${buildDir.toString()}</p>
                <p><strong>Loader URL:</strong> ${loaderUrl}</p>
                <p><strong>Data URL:</strong> ${dataUrl}</p>
                <p><strong>Framework URL:</strong> ${frameworkUrl}</p>
                <p><strong>WASM URL:</strong> ${wasmUrl}</p>
                <p><strong>User Agent:</strong> <span id="userAgent"></span></p>
                <button onclick="hideDebugInfo()">Hide Debug</button>
                <button onclick="retryLoad()">Retry Load</button>
            </div>
            
            <div id="gameContainer" style="display: none;">
                <canvas id="unity-canvas" data-pixel-art="true"></canvas>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                let loadTimeout;
                let unityInstance = null;

                function sendMessage(command, text) {
                    vscode.postMessage({
                        command: command,
                        text: text
                    });
                }

                function updateProgress(progress) {
                    const percent = Math.round(progress * 100);
                    const progressBar = document.getElementById('progressBar');
                    const loadingText = document.getElementById('loadingText');
                    
                    if (progressBar) {
                        progressBar.style.width = percent + '%';
                    }
                    
                    if (loadingText) {
                        loadingText.textContent = 'Loading Unity WebGL... ' + percent + '%';
                    }
                    
                    sendMessage('debug', 'Unity loading progress: ' + percent + '%');
                }

                function onUnityLoaded(instance) {
                    console.log('Unity instance loaded successfully');
                    clearTimeout(loadTimeout);
                    unityInstance = instance;
                    
                    document.getElementById('loading').style.display = 'none';
                    document.getElementById('error').style.display = 'none';
                    document.getElementById('debug').style.display = 'none';
                    document.getElementById('gameContainer').style.display = 'block';
                    
                    onResize();
                    sendMessage('gameLoaded', 'Unity WebGL game loaded successfully');
                }

                function onUnityError(message) {
                    console.error('Unity loading error:', message);
                    clearTimeout(loadTimeout);
                    document.getElementById('loading').style.display = 'none';
                    document.getElementById('gameContainer').style.display = 'none';
                    document.getElementById('error').style.display = 'flex';
                    document.getElementById('errorMessage').textContent = message;
                    sendMessage('error', 'Unity error: ' + message);
                }

                function loadUnityGame() {
                    sendMessage('debug', 'Starting Unity WebGL load...');
                    
                    const canvas = document.querySelector("#unity-canvas");
                    const config = {
                        dataUrl: "${dataUrl}",
                        frameworkUrl: "${frameworkUrl}",
                        codeUrl: "${wasmUrl}",
                        companyName: "Die in the Dungeon Team",
                        productName: "Die in the Dungeon",
                        productVersion: "72f",
                    };

                    // Load Unity loader script
                    const script = document.createElement('script');
                    script.src = "${loaderUrl}";
                    script.onload = function() {
                        sendMessage('debug', 'Unity loader script loaded');
                        
                        // Create Unity instance
                        if (typeof createUnityInstance !== 'undefined') {
                            createUnityInstance(canvas, config, updateProgress)
                                .then(onUnityLoaded)
                                .catch(onUnityError);
                        } else {
                            onUnityError('createUnityInstance function not available');
                        }
                    };
                    script.onerror = function() {
                        onUnityError('Failed to load Unity loader script');
                    };
                    
                    document.head.appendChild(script);
                }

                function onResize() {
                    if (!unityInstance) return;
                    
                    const container = document.getElementById('gameContainer');
                    const canvas = document.getElementById('unity-canvas');
                    
                    if (!container || !canvas) return;
                    
                    const w = window.innerWidth;
                    const h = window.innerHeight;
                    const r = 540 / 960;

                    let gameW = w;
                    let gameH = h;

                    if (w * r > h) {
                        gameW = Math.min(w, Math.ceil(h / r));
                    }
                    gameH = Math.floor(gameW * r);

                    container.style.width = canvas.style.width = gameW + "px";
                    container.style.height = canvas.style.height = gameH + "px";
                    container.style.top = Math.floor((h - gameH) / 2) + "px";
                    container.style.left = Math.floor((w - gameW) / 2) + "px";
                }

                function retryLoad() {
                    console.log('Retrying Unity game load');
                    document.getElementById('loading').style.display = 'flex';
                    document.getElementById('error').style.display = 'none';
                    document.getElementById('debug').style.display = 'none';
                    document.getElementById('gameContainer').style.display = 'none';
                    
                    // Reset progress
                    document.getElementById('progressBar').style.width = '0%';
                    document.getElementById('loadingText').textContent = 'Initializing Unity...';
                    
                    loadUnityGame();
                    startLoadTimeout();
                    sendMessage('debug', 'Retrying Unity game load');
                }

                function showDebugInfo() {
                    document.getElementById('userAgent').textContent = navigator.userAgent;
                    document.getElementById('loading').style.display = 'none';
                    document.getElementById('error').style.display = 'none';
                    document.getElementById('debug').style.display = 'flex';
                }

                function hideDebugInfo() {
                    document.getElementById('debug').style.display = 'none';
                    document.getElementById('loading').style.display = 'flex';
                }

                function startLoadTimeout() {
                    loadTimeout = setTimeout(() => {
                        onUnityError('Unity game loading timed out after 30 seconds');
                    }, 30000);
                }

                // Initialize when page loads
                window.addEventListener('load', () => {
                    sendMessage('debug', 'WebView HTML loaded - starting Unity');
                    loadUnityGame();
                    startLoadTimeout();
                });

                window.addEventListener('resize', onResize);

                // Log any console errors
                window.addEventListener('error', (e) => {
                    sendMessage('error', 'JavaScript error: ' + e.message);
                });
            </script>
        </body>
        </html>`;
    }
} 