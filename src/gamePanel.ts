import * as vscode from 'vscode';
import { GameManager, GameInfo } from './gameManager';

export class GamePanel {
    public static readonly viewType = 'ritalinGame';
    private _panel: vscode.WebviewPanel | undefined;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _isInitialized = false;
    private _isVisible = false;
    private _currentGame: GameInfo | undefined;

    constructor(extensionUri: vscode.Uri) {
        this._extensionUri = extensionUri;
        console.log('[Ritalin] GamePanel constructor called');
        
        // Create the panel but don't load game yet
        this._createPanel();
    }

    public loadGame(gameInfo: GameInfo): void {
        console.log('[Ritalin] Loading game:', gameInfo.title);
        this._currentGame = gameInfo;
        
        if (this._panel) {
            this._panel.webview.html = this._getHtmlForWebview();
        }
    }

    private _createPanel(): void {
        console.log('[Ritalin] Creating game panel...');
        
        // Create panel that stays in background
        this._panel = vscode.window.createWebviewPanel(
            GamePanel.viewType,
            'Ritalin Game',
            { viewColumn: vscode.ViewColumn.Two, preserveFocus: true },
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    this._extensionUri,
                    vscode.Uri.joinPath(this._extensionUri, 'games')
                ]
            }
        );

        // Set up message handling
        this._panel.webview.onDidReceiveMessage(
            message => {
                console.log('[Ritalin] WebView message:', message);
                switch (message.command) {
                    case 'debug':
                        console.log('[Ritalin] Debug:', message.text);
                        break;
                    case 'error':
                        console.error('[Ritalin] WebView Error:', message.text);
                        break;
                    case 'gameLoaded':
                        console.log('[Ritalin] Game loaded successfully');
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
        if (!this._currentGame || !this._currentGame.isDownloaded || !this._currentGame.entryPoint) {
            return this._getNoGameSelectedHtml();
        }

        return this._getGameHtml(this._currentGame);
    }

    private _getGameHtml(gameInfo: GameInfo): string {
        const gameUri = this._panel!.webview.asWebviewUri(vscode.Uri.file(gameInfo.entryPoint!));
        
        return `<!DOCTYPE html>
        <html lang="en-us">
        <head>
            <meta charset="utf-8">
            <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
            <title>Ritalin - ${gameInfo.title}</title>
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
                
                #gameContainer {
                    width: 100%;
                    height: 100%;
                    position: relative;
                }
                
                #gameFrame {
                    width: 100%;
                    height: 100%;
                    border: none;
                    background: #000000;
                }

                /* Visibility control */
                body.hidden #gameContainer {
                    display: none !important;
                }
                
                .loading {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    color: #fff;
                    background: #000;
                }
                
                body.hidden .loading {
                    display: none !important;
                }
            </style>
        </head>
        <body>
            <div class="loading" id="loading">
                <p>Loading ${gameInfo.title}...</p>
            </div>
            
            <div id="gameContainer" style="display: none;">
                <iframe id="gameFrame" src="${gameUri}"></iframe>
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                // Handle iframe load
                document.getElementById('gameFrame').onload = function() {
                    document.getElementById('loading').style.display = 'none';
                    document.getElementById('gameContainer').style.display = 'block';
                    vscode.postMessage({ command: 'gameLoaded' });
                };

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