import * as vscode from 'vscode';
import { GameManager } from './gameManager';
import { GameInfo } from './types';
import { GameWindowManager } from './GameWindowManager';
import { CursorDetector } from './cursorDetector';
import { ConfigPanel } from './ConfigPanel';

let gameManager: GameManager;
let gameWindowManager: GameWindowManager;
let cursorDetector: CursorDetector;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('Ritalin');
    outputChannel.appendLine('[Ritalin] Extension activating...');

    gameManager = new GameManager(context, outputChannel);
    gameWindowManager = new GameWindowManager(context, outputChannel);
    cursorDetector = new CursorDetector(outputChannel);

    // Show welcome page on first install/update
    if (context.globalState.get('ritalin.hasShownWelcomePageV1') === undefined) {
        outputChannel.appendLine('[Ritalin] First install detected, showing welcome page');
        ConfigPanel.createOrShow(context.extensionUri, gameManager, outputChannel);
        context.globalState.update('ritalin.hasShownWelcomePageV1', true);
    }

    // Initialize managers
    gameManager.initialize().catch(error => {
        outputChannel.appendLine(`[GameManager] Initialization failed: ${error}`);
    });
    gameWindowManager.start().catch(error => {
        outputChannel.appendLine(`[GameWindowManager] Startup failed: ${error}`);
    });


    // --- COMMAND REGISTRATION ---
    context.subscriptions.push(
        vscode.commands.registerCommand('ritalin.showGame', () => gameWindowManager.show()),
        vscode.commands.registerCommand('ritalin.hideGame', () => gameWindowManager.hide()),
        vscode.commands.registerCommand('ritalin.searchGames', () => showGameSearchDialog()),
        vscode.commands.registerCommand('ritalin.manageGames', () => showGameManagementDialog()),
        vscode.commands.registerCommand('ritalin.openSettings', () => {
            vscode.commands.executeCommand('workbench.action.openSettings', 'ritalin');
        }),
        vscode.commands.registerCommand('ritalin.testExternalWindow', () => {
            gameWindowManager.show();
        }),
        vscode.commands.registerCommand('ritalin.configureExternalWindow', () => {
            vscode.commands.executeCommand('workbench.action.openSettings', 'ritalin.externalWindow');
        }),
        vscode.commands.registerCommand('ritalin.showConfig', () => {
            outputChannel.appendLine('[Ritalin] showConfig command called');
            ConfigPanel.createOrShow(context.extensionUri, gameManager, outputChannel);
        })
    );
    
    // --- WORKSPACE CHANGE LISTENER ---
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
        outputChannel.appendLine('[Ritalin] Workspace changed, re-initializing components.');
        cursorDetector?.dispose();
        gameWindowManager?.dispose();

        gameManager = new GameManager(context, outputChannel);
        gameWindowManager = new GameWindowManager(context, outputChannel);
        cursorDetector = new CursorDetector(outputChannel);
    });

    outputChannel.appendLine('[Ritalin] Extension activated successfully.');
}

async function showGameSearchDialog(): Promise<void> {
    const query = await vscode.window.showInputBox({
        prompt: 'Search itch.io for Unity WebGL games',
        placeHolder: 'Enter search terms (e.g., "puzzle", "platformer")',
        value: 'unity webgl'
    });

    if (!query) { return; }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Searching for "${query}"...`,
        cancellable: false
    }, async () => {
        try {
            const games = await gameManager.searchItchGames(query);
            if (games.length === 0) {
                vscode.window.showInformationMessage('No games found.');
                return;
            }

            const gameItems = games.map(g => ({
                label: g.title,
                description: `by ${g.author}`,
                detail: g.isDownloaded ? '✓ Downloaded' : 'Click to download',
                game: g
            }));

            const selected = await vscode.window.showQuickPick(gameItems, { placeHolder: 'Select a game to download' });

            if (selected && !selected.game.isDownloaded) {
                await downloadAndSelectGame(selected.game);
            } else if (selected?.game.isDownloaded) {
                await gameManager.setSelectedGame(selected.game.id);
                vscode.window.showInformationMessage(`Selected ${selected.game.title}`);
                gameWindowManager.loadGame(selected.game);
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Search failed: ${error.message}`);
        }
    });
}

async function downloadAndSelectGame(game: GameInfo): Promise<void> {
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Downloading ${game.title}...`,
        cancellable: false
    }, async () => {
        try {
            const downloadedGame = await gameManager.downloadGame(game);
            await gameManager.setSelectedGame(downloadedGame.id);
            vscode.window.showInformationMessage(`Successfully downloaded and selected ${downloadedGame.title}!`);
            gameWindowManager.loadGame(downloadedGame);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Download failed: ${error.message}`);
        }
    });
}

async function showGameManagementDialog(): Promise<void> {
    const downloadedGames = gameManager.getDownloadedGames();
    if (downloadedGames.length === 0) {
        const result = await vscode.window.showInformationMessage(
            'No games downloaded. Would you like to search for one?',
            'Search Games'
        );
        if (result === 'Search Games') { await showGameSearchDialog(); }
        return;
    }

    const selectedGame = gameManager.getSelectedGame();
    const gameItems = downloadedGames.map(g => ({
        label: g.title,
        description: `by ${g.author}`,
        detail: selectedGame?.id === g.id ? '★ Selected' : 'Click to select',
        game: g
    }));

    const selected = await vscode.window.showQuickPick(gameItems, { placeHolder: 'Select a game to manage' });
    if (!selected) { return; }

    const actions = [
        { label: '$(star) Set as Default', action: 'select' },
        { label: '$(trash) Delete Game', action: 'delete' }
    ];
    const action = await vscode.window.showQuickPick(actions, { title: `Actions for ${selected.game.title}` });
    if (!action) { return; }

    try {
        if (action.action === 'select') {
            await gameManager.setSelectedGame(selected.game.id);
            vscode.window.showInformationMessage(`Selected ${selected.game.title}`);
            gameWindowManager.loadGame(selected.game);
        } else if (action.action === 'delete') {
            const confirm = await vscode.window.showWarningMessage(`Delete ${selected.game.title}?`, { modal: true }, 'Delete');
            if (confirm === 'Delete') {
                await gameManager.deleteGame(selected.game.id);
                vscode.window.showInformationMessage(`Deleted ${selected.game.title}`);
            }
        }
    } catch (error: any) {
        vscode.window.showErrorMessage(`Action failed: ${error.message}`);
    }
}

export function deactivate() {
    outputChannel.appendLine('[Ritalin] Deactivating extension...');
    cursorDetector?.dispose();
    gameWindowManager?.dispose();
    outputChannel?.dispose();
    console.log('[Ritalin] Ritalin deactivated successfully.');
}