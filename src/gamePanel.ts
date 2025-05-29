import * as vscode from 'vscode';

export class GamePanel {
    public static readonly viewType = 'ritalinGame';
    private _panel: vscode.WebviewPanel | undefined;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    constructor(extensionUri: vscode.Uri) {
        this._extensionUri = extensionUri;
    }

    public show(): void {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (this._panel) {
            this._panel.reveal(column);
            return;
        }

        // Create new panel
        this._panel = vscode.window.createWebviewPanel(
            GamePanel.viewType,
            'Ritalin Game',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [this._extensionUri]
            }
        );

        // Set the HTML content
        this._panel.webview.html = this._getHtmlForWebview();

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
        const gameUrl = config.get<string>('gameUrl', 'https://disorium.itch.io/die-in-the-dungeon');
        const width = config.get<number>('windowWidth', 800);
        const height = config.get<number>('windowHeight', 600);

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Ritalin Game</title>
            <style>
                body, html {
                    margin: 0;
                    padding: 0;
                    width: 100%;
                    height: 100vh;
                    overflow: hidden;
                }
                iframe {
                    width: 100%;
                    height: 100%;
                    border: none;
                }
                .loading {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    font-family: Arial, sans-serif;
                    color: #666;
                }
            </style>
        </head>
        <body>
            <div class="loading" id="loading">Loading game...</div>
            <iframe 
                id="gameFrame"
                src="${gameUrl}" 
                style="display: none;"
                onload="document.getElementById('loading').style.display='none'; this.style.display='block';">
            </iframe>
        </body>
        </html>`;
    }
} 