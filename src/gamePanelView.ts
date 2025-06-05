import * as vscode from 'vscode';
import { GameManager, GameInfo } from './gameManager';

export class GamePanelViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'ritalin.gameView';

    private _view?: vscode.WebviewView;
    private _currentGame: GameInfo | undefined;
    private _isVisible = false;
    private _outputChannel: vscode.OutputChannel;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext
    ) {
        this._outputChannel = vscode.window.createOutputChannel('Ritalin Panel Debug');
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        console.log('[Ritalin] Resolving webview view');
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri,
                vscode.Uri.joinPath(this._extensionUri, 'games'),
                vscode.Uri.file(require('path').join(this._context.globalStorageUri.fsPath, 'games'))
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(
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
                    case 'gameLoaded':
                        console.log('[Ritalin] Game loaded successfully');
                        this._outputChannel.appendLine('[SUCCESS] Game loaded successfully!');
                        break;
                }
            }
        );

        // Handle visibility changes
        webviewView.onDidChangeVisibility(() => {
            console.log('[Ritalin] Visibility changed:', webviewView.visible);
            this._isVisible = webviewView.visible;
        });
    }

    public loadGame(gameInfo: GameInfo): void {
        console.log('[Ritalin] Loading game in panel view:', gameInfo.title);
        this._currentGame = gameInfo;
        
        if (this._view) {
            // Update localResourceRoots if needed
            if (gameInfo.entryPoint) {
                const gameDir = vscode.Uri.file(require('path').dirname(gameInfo.entryPoint));
                this._view.webview.options = {
                    enableScripts: true,
                    localResourceRoots: [
                        this._extensionUri,
                        vscode.Uri.joinPath(this._extensionUri, 'games'),
                        vscode.Uri.file(require('path').join(this._context.globalStorageUri.fsPath, 'games')),
                        gameDir
                    ]
                };
            }
            
            this._view.webview.html = this._getHtmlForWebview(this._view.webview);
        }
    }

    public show(): void {
        console.log('[Ritalin] Showing game panel view');
        if (this._view) {
            this._view.show?.(true); // Focus the view
            this._isVisible = true;
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        if (!this._currentGame || !this._currentGame.isDownloaded || !this._currentGame.entryPoint) {
            return this._getNoGameSelectedHtml();
        }

        return this._getGameHtml(webview, this._currentGame);
    }

    private _getGameHtml(webview: vscode.Webview, gameInfo: GameInfo): string {
        const fs = require('fs');
        let gameHtmlContent = '';
        
        try {
            gameHtmlContent = fs.readFileSync(gameInfo.entryPoint!, 'utf8');
        } catch (error) {
            console.error('[Ritalin] Failed to read game HTML:', error);
            return this._getGameErrorHtml(gameInfo, error);
        }
        
        // Process the HTML content similar to the original implementation
        const gameDir = require('path').dirname(gameInfo.entryPoint!);
        
        // Replace relative paths with webview URIs
        gameHtmlContent = gameHtmlContent.replace(
            /src="([^"]+)"/g, 
            (match, path) => {
                if (path.startsWith('http')) {
                    return match;
                }
                
                const decodedPath = decodeURIComponent(path);
                const fullPath = require('path').resolve(gameDir, decodedPath);
                
                if (!require('fs').existsSync(fullPath)) {
                    console.warn(`[Ritalin] File not found: ${fullPath}`);
                    return match;
                }
                
                try {
                    const webviewUri = webview.asWebviewUri(vscode.Uri.file(fullPath));
                    return `src="${webviewUri}"`;
                } catch (error) {
                    console.error(`[Ritalin] Failed to create webview URI for ${fullPath}:`, error);
                    return match;
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
                    const webviewUri = webview.asWebviewUri(vscode.Uri.file(fullPath));
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
        
        // Add debug overlay and scripts
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
                <div>🎮 Ritalin Panel</div>
                <div>Game: ${gameInfo.title}</div>
                <div id="debugStatus">Status: Loading...</div>
            </div>
        `;
        
        const ritalinScript = `
            <script>
                const vscode = acquireVsCodeApi();
                
                function addDebugLog(message) {
                    console.log('[Ritalin]', message);
                    vscode.postMessage({ 
                        command: 'debug', 
                        text: message 
                    });
                }
                
                window.addEventListener('DOMContentLoaded', function() {
                    addDebugLog('Panel view loaded');
                    document.getElementById('debugStatus').textContent = 'Status: Ready';
                    
                    setTimeout(() => {
                        document.getElementById('ritalinDebug').style.display = 'none';
                    }, 5000);
                });
                
                window.addEventListener('error', function(event) {
                    vscode.postMessage({ 
                        command: 'error', 
                        text: event.error ? event.error.message : event.message 
                    });
                });
            </script>
        `;
        
        // Insert our overlay and script
        const bodyCloseIndex = gameHtmlContent.lastIndexOf('</body>');
        if (bodyCloseIndex !== -1) {
            gameHtmlContent = 
                gameHtmlContent.substring(0, bodyCloseIndex) +
                debugOverlay +
                ritalinScript +
                gameHtmlContent.substring(bodyCloseIndex);
        }
        
        return gameHtmlContent;
    }

    private _getGameErrorHtml(gameInfo: GameInfo, error: any): string {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="utf-8">
            <title>Ritalin - Error Loading Game</title>
            <style>
                body {
                    background: #1e1e1e;
                    color: #fff;
                    font-family: Arial, sans-serif;
                    padding: 20px;
                    margin: 0;
                }
                .error-container {
                    text-align: center;
                }
                h2 { color: #f44; }
                .error-details {
                    background: #2d2d2d;
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
                <h2>Error Loading Game</h2>
                <p>Failed to load: ${gameInfo.title}</p>
                <div class="error-details">
                    <strong>Error:</strong> ${error.message || error}
                    <br><br>
                    <strong>Game Path:</strong> ${gameInfo.entryPoint || 'Not set'}
                </div>
            </div>
        </body>
        </html>`;
    }

    private _getNoGameSelectedHtml(): string {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="utf-8">
            <title>Ritalin - No Game Selected</title>
            <style>
                body {
                    background: #1e1e1e;
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
                .container {
                    text-align: center;
                    max-width: 400px;
                }
                h2 { color: #007acc; }
                p { color: #ccc; line-height: 1.6; }
                .hint {
                    background: #2d2d2d;
                    border: 1px solid #444;
                    border-radius: 5px;
                    padding: 15px;
                    margin-top: 20px;
                }
                code {
                    background: #333;
                    padding: 2px 5px;
                    border-radius: 3px;
                    font-family: monospace;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>🎮 No Game Selected</h2>
                <p>Select a game to play while Cursor AI generates code!</p>
                <div class="hint">
                    <p><strong>Quick Start:</strong></p>
                    <p>1. Use <code>Ctrl+Shift+P</code> (or <code>Cmd+Shift+P</code> on Mac)</p>
                    <p>2. Run <code>Ritalin: Search itch.io Games</code></p>
                    <p>3. Select and download a game</p>
                    <p>4. The game will appear here!</p>
                </div>
            </div>
        </body>
        </html>`;
    }
} 