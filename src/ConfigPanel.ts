import * as vscode from 'vscode';
import { GameManager } from './gameManager';
import { GameInfo } from './types';

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

export class ConfigPanel {
    public static currentPanel: ConfigPanel | undefined;
    public static readonly viewType = 'ritalinConfig';
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _gameManager: GameManager;
    private readonly _outputChannel: vscode.OutputChannel;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri, gameManager: GameManager, outputChannel: vscode.OutputChannel) {
        const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

        if (ConfigPanel.currentPanel) {
            ConfigPanel.currentPanel._panel.reveal(column);
            outputChannel.appendLine('[ConfigPanel] Revealing existing panel');
            return;
        }

        outputChannel.appendLine('[ConfigPanel] Creating new panel');
        const panel = vscode.window.createWebviewPanel(
            ConfigPanel.viewType, 'Ritalin Configuration', column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'media'),
                    vscode.Uri.joinPath(extensionUri, 'media', 'game-images')
                ]
            }
        );

        ConfigPanel.currentPanel = new ConfigPanel(panel, extensionUri, gameManager, outputChannel);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, gameManager: GameManager, outputChannel: vscode.OutputChannel) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._gameManager = gameManager;
        this._outputChannel = outputChannel;

        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'debug':
                        this._outputChannel.appendLine(`[ConfigPanel WebView] ${message.text}`);
                        return;
                    case 'getPopularGames':
                        this._outputChannel.appendLine('[ConfigPanel] Received getPopularGames request');
                        try {
                            this._outputChannel.appendLine('[ConfigPanel] Calling gameManager.getPopularGames()...');
                            const games = await this._gameManager.getPopularGames();
                            this._outputChannel.appendLine(`[ConfigPanel] Got ${games.length} popular games`);
                            // Convert relative image paths to webview URIs
                            const gamesWithWebviewUris = games.map(game => ({
                                ...game,
                                cover_image: game.cover_image && game.cover_image.startsWith('game-images/') 
                                    ? this._panel.webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', game.cover_image)).toString()
                                    : game.cover_image
                            }));
                            const selectedGame = this._gameManager.getSelectedGame();
                            this._outputChannel.appendLine(`[ConfigPanel] Sending games to webview: ${games.map(g => g.title).join(', ')}`);
                            this._panel.webview.postMessage({ 
                                command: 'popularGames', 
                                games: gamesWithWebviewUris,
                                selectedGameId: selectedGame?.id || null
                            });
                        } catch (error: any) {
                            this._outputChannel.appendLine(`[ConfigPanel] Error getting popular games: ${error}`);
                            vscode.window.showErrorMessage(`Failed to get popular games: ${error.message}`);
                        }
                        return;
                    case 'searchGames':
                        try {
                            const games = await this._gameManager.searchItchGames(message.query);
                            const selectedGame = this._gameManager.getSelectedGame();
                            this._panel.webview.postMessage({ 
                                command: 'searchResults', 
                                games: games,
                                selectedGameId: selectedGame?.id || null
                            });
                        } catch (error: any) {
                            vscode.window.showErrorMessage(`Search failed: ${error.message}`);
                        }
                        return;
                    case 'downloadGame':
                        vscode.window.withProgress({
                            location: vscode.ProgressLocation.Notification,
                            title: `Downloading ${message.game.title}...`,
                            cancellable: false
                        }, async () => {
                            try {
                                const downloadedGame = await this._gameManager.downloadGame(message.game);
                                await this._gameManager.setSelectedGame(downloadedGame.id);
                                this._panel.webview.postMessage({ command: 'downloadFinished', game: downloadedGame });
                                vscode.window.showInformationMessage(`Successfully downloaded and selected ${downloadedGame.title}!`);
                            } catch (error: any) {
                                vscode.window.showErrorMessage(`Download failed: ${error.message}`);
                            }
                        });
                        return;
                    case 'selectGame':
                        try {
                            await this._gameManager.setSelectedGame(message.gameId);
                            this._panel.webview.postMessage({ command: 'gameSelected', gameId: message.gameId });
                            const selectedGame = this._gameManager.getSelectedGame();
                            vscode.window.showInformationMessage(`Selected ${selectedGame?.title || 'game'}!`);
                        } catch (error: any) {
                            vscode.window.showErrorMessage(`Failed to select game: ${error.message}`);
                        }
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public dispose() {
        ConfigPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'style.css'));
        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; img-src https://img.itch.zone https: data: 'self';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleUri}" rel="stylesheet" />
                <title>Ritalin Configuration</title>
            </head>
            <body>
                <h1>Welcome to Ritalin!</h1>
                <p>Your companion for staying focused during AI generation. Let's get you set up.</p>
                
                <h2>Search for Games</h2>
                <p>Search for games on itch.io to add to your collection.</p>
                <div class="search-container">
                    <input type="text" id="game-search-input" placeholder="Search for games (e.g., 'puzzle', 'deckbuilder')...">
                    <div id="search-results"></div>
                </div>

                <h2>Popular Turn-Based Games</h2>
                <p>Here are some popular games from <a href="https://itch.io/games/platform-web/tag-turn-based">itch.io's turn-based category</a>. Data is scraped live.</p>
                <div id="popular-games-list" class="game-grid">
                    <!-- Popular games will be injected here by the script -->
                </div>

                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }
} 