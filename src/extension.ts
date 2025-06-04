import * as vscode from 'vscode';
import { GamePanel } from './gamePanel';
import { CursorDetector } from './cursorDetector';
import { GameManager, GameInfo } from './gameManager';

let gamePanel: GamePanel | undefined;
let cursorDetector: CursorDetector | undefined;
let gameManager: GameManager | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('[Ritalin] Extension is now activating!');
    console.log('[Ritalin] Extension URI:', context.extensionUri.toString());
    console.log('[Ritalin] Global Storage Path:', context.globalStorageUri?.fsPath);

    // Initialize the game panel FIRST
    console.log('[Ritalin] Initializing GamePanel...');
    gamePanel = new GamePanel(context.extensionUri, context);
    
    // Initialize the cursor detector
    console.log('[Ritalin] Initializing CursorDetector...');
    cursorDetector = new CursorDetector();

    // Initialize the game manager AFTER panel is ready
    console.log('[Ritalin] Initializing GameManager...');
    gameManager = new GameManager(context);

    // Initialize GameManager (download default game if needed)
    gameManager.initialize().then(() => {
        console.log('[Ritalin] GameManager initialization complete');
        
        // Log all downloaded games
        const downloadedGames = gameManager?.getDownloadedGames();
        console.log('[Ritalin] Downloaded games found:', downloadedGames?.length || 0);
        downloadedGames?.forEach(game => {
            console.log(`[Ritalin]   - ${game.title} (${game.id}) [Downloaded: ${game.isDownloaded}] [Entry: ${game.entryPoint}]`);
        });
        
        // Load selected game into the panel if available
        const selectedGame = gameManager?.getSelectedGame();
        if (selectedGame && gamePanel) {
            console.log('[Ritalin] Loading selected game:', selectedGame.title);
            console.log('[Ritalin] Game entry point:', selectedGame.entryPoint);
            gamePanel.loadGame(selectedGame);
        } else {
            console.log('[Ritalin] No selected game found');
        }
    }).catch(error => {
        console.error('[Ritalin] GameManager initialization failed:', error);
    });

    // Register commands
    console.log('[Ritalin] Registering commands...');
    
    // Add explicit preload command for debugging
    const preloadGameCommand = vscode.commands.registerCommand('ritalin.preloadGame', async () => {
        console.log('[Ritalin] Preload game command triggered');
        
        if (!gamePanel) {
            console.error('[Ritalin] GamePanel is undefined! Creating new panel...');
            gamePanel = new GamePanel(context.extensionUri, context);
        }
        
        if (!gameManager) {
            console.error('[Ritalin] GameManager is undefined!');
            vscode.window.showErrorMessage('GameManager not initialized. Please wait for extension activation to complete.');
            return;
        }
        
        // Show debug information
        const downloadedGames = gameManager.getDownloadedGames();
        const selectedGame = gameManager.getSelectedGame();
        
        console.log('[Ritalin] === PRELOAD DEBUG INFO ===');
        console.log('[Ritalin] Downloaded games:', downloadedGames.length);
        console.log('[Ritalin] Selected game:', selectedGame?.title || 'None');
        console.log('[Ritalin] GamePanel exists:', !!gamePanel);
        console.log('[Ritalin] GameManager exists:', !!gameManager);
        
        // Show status in notification
        const statusMessage = `
Debug Status:
- Downloaded games: ${downloadedGames.length}
- Selected game: ${selectedGame?.title || 'None'}
- Panel ready: ${!!gamePanel}
- Manager ready: ${!!gameManager}
        `.trim();
        
        vscode.window.showInformationMessage(statusMessage, { modal: false });
        
        // If we have a selected game, preload it
        if (selectedGame && gamePanel) {
            console.log('[Ritalin] Preloading selected game:', selectedGame.title);
            console.log('[Ritalin] Game entry point:', selectedGame.entryPoint);
            console.log('[Ritalin] Game is downloaded:', selectedGame.isDownloaded);
            
            gamePanel.preload(selectedGame);
            vscode.window.showInformationMessage(`Preloaded: ${selectedGame.title}`);
        } else if (!selectedGame) {
            console.log('[Ritalin] No game selected for preload');
            gamePanel.preload(); // Show debug info even without a game
            vscode.window.showWarningMessage('No game selected. Use "Search itch.io Games" to download a game first.');
        } else {
            console.log('[Ritalin] Cannot preload - GamePanel not available');
            vscode.window.showErrorMessage('GamePanel not available. Extension may not be fully initialized.');
        }
    });
    
    const showGameCommand = vscode.commands.registerCommand('ritalin.showGame', () => {
        console.log('[Ritalin] Show game command triggered');
        if (gamePanel) {
            gamePanel.show();
        } else {
            console.error('[Ritalin] GamePanel is undefined!');
        }
    });

    const hideGameCommand = vscode.commands.registerCommand('ritalin.hideGame', () => {
        console.log('[Ritalin] Hide game command triggered');
        if (gamePanel) {
            gamePanel.hide();
        }
    });

    const toggleGameCommand = vscode.commands.registerCommand('ritalin.toggleGame', () => {
        console.log('[Ritalin] Toggle game command triggered');
        if (gamePanel) {
            gamePanel.toggle();
        }
    });

    const searchGamesCommand = vscode.commands.registerCommand('ritalin.searchGames', async () => {
        console.log('[Ritalin] Search games command triggered');
        await showGameSearchDialog();
    });

    const manageGamesCommand = vscode.commands.registerCommand('ritalin.manageGames', async () => {
        console.log('[Ritalin] Manage games command triggered');
        await showGameManagementDialog();
    });

    const openSettingsCommand = vscode.commands.registerCommand('ritalin.openSettings', () => {
        console.log('[Ritalin] Open settings command triggered');
        vscode.commands.executeCommand('workbench.action.openSettings', 'ritalin');
    });

    // Add to subscriptions for cleanup
    context.subscriptions.push(
        preloadGameCommand,
        showGameCommand,
        hideGameCommand,
        toggleGameCommand,
        searchGamesCommand,
        manageGamesCommand,
        openSettingsCommand
    );

    console.log('[Ritalin] Commands registered successfully');

    // Set up cursor detection event handlers
    if (cursorDetector) {
        console.log('[Ritalin] Setting up cursor detection handlers...');
        cursorDetector.onAiGenerationStart(() => {
            console.log('[Ritalin] AI generation detected - checking config...');
            const config = vscode.workspace.getConfiguration('ritalin');
            const enabled = config.get<boolean>('enabled', true);
            const delay = config.get<number>('showDelay', 2000);

            console.log('[Ritalin] Config - enabled:', enabled, 'delay:', delay);

            if (enabled && gamePanel) {
                console.log('[Ritalin] Showing game after delay...');
                setTimeout(() => {
                    gamePanel?.show();
                }, delay);
            }
        });

        cursorDetector.onAiGenerationEnd(() => {
            console.log('[Ritalin] AI generation ended - hiding game');
            if (gamePanel) {
                gamePanel.hide();
            }
        });
    }

    console.log('[Ritalin] Extension activation complete!');
}

async function showGameSearchDialog(): Promise<void> {
    if (!gameManager) {
        vscode.window.showErrorMessage('Game manager not initialized');
        return;
    }

    // Get search query from user
    const query = await vscode.window.showInputBox({
        prompt: 'Search itch.io for Unity WebGL games',
        placeHolder: 'Enter search terms (e.g., "puzzle", "platformer", "arcade")',
        value: 'unity webgl'
    });

    if (!query) {
        return;
    }

    // Show progress
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Searching itch.io...',
        cancellable: false
    }, async (progress) => {
        try {
            progress.report({ message: 'Searching for games...' });
            const games = await gameManager!.searchItchGames(query);

            if (games.length === 0) {
                vscode.window.showInformationMessage('No Unity WebGL games found for that search');
                return;
            }

            // Show game selection dialog
            const gameItems = games.map(game => ({
                label: game.title,
                description: `by ${game.author}`,
                detail: game.isDownloaded ? '✓ Downloaded' : 'Click to download',
                game: game
            }));

            const selected = await vscode.window.showQuickPick(gameItems, {
                title: `Found ${games.length} games`,
                placeHolder: 'Select a game to download'
            });

            if (selected && !selected.game.isDownloaded) {
                await downloadAndSelectGame(selected.game);
            } else if (selected && selected.game.isDownloaded) {
                await gameManager!.setSelectedGame(selected.game.id);
                vscode.window.showInformationMessage(`Selected ${selected.game.title} as default game`);
            }

        } catch (error) {
            vscode.window.showErrorMessage(`Search failed: ${error}`);
        }
    });
}

async function showGameManagementDialog(): Promise<void> {
    if (!gameManager) {
        vscode.window.showErrorMessage('Game manager not initialized');
        return;
    }

    const downloadedGames = gameManager.getDownloadedGames();
    const selectedGame = gameManager.getSelectedGame();

    if (downloadedGames.length === 0) {
        const result = await vscode.window.showInformationMessage(
            'No games downloaded yet. Would you like to search for games?',
            'Search Games'
        );
        if (result === 'Search Games') {
            await showGameSearchDialog();
        }
        return;
    }

    const gameItems = downloadedGames.map(game => ({
        label: game.title,
        description: `by ${game.author}`,
        detail: selectedGame?.id === game.id ? '★ Selected' : 'Click to select',
        game: game
    }));

    gameItems.push({
        label: '$(search) Search for more games',
        description: '',
        detail: 'Find new games on itch.io',
        game: null as any
    });

    const selected = await vscode.window.showQuickPick(gameItems, {
        title: 'Manage Downloaded Games',
        placeHolder: 'Select a game or action'
    });

    if (!selected) {
        return;
    }

    if (!selected.game) {
        // Search for more games
        await showGameSearchDialog();
        return;
    }

    // Show game actions
    const actions = [
        { label: '$(star) Set as Default', action: 'select' },
        { label: '$(trash) Delete Game', action: 'delete' }
    ];

    const action = await vscode.window.showQuickPick(actions, {
        title: `Actions for ${selected.game.title}`,
        placeHolder: 'Choose an action'
    });

    if (!action) {
        return;
    }

    try {
        switch (action.action) {
            case 'select':
                await gameManager.setSelectedGame(selected.game.id);
                vscode.window.showInformationMessage(`Selected ${selected.game.title} as default game`);
                break;

            case 'delete':
                const confirm = await vscode.window.showWarningMessage(
                    `Delete ${selected.game.title}?`,
                    { modal: true },
                    'Delete'
                );
                if (confirm === 'Delete') {
                    await gameManager.deleteGame(selected.game.id);
                    vscode.window.showInformationMessage(`Deleted ${selected.game.title}`);
                }
                break;
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Action failed: ${error}`);
    }
}

async function downloadAndSelectGame(game: GameInfo): Promise<void> {
    if (!gameManager) {
        return;
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Downloading ${game.title}...`,
        cancellable: false
    }, async (progress) => {
        try {
            progress.report({ message: 'Extracting game files...' });
            const downloadedGame = await gameManager!.downloadGame(game);
            
            progress.report({ message: 'Setting as default game...' });
            await gameManager!.setSelectedGame(downloadedGame.id);
            
            vscode.window.showInformationMessage(
                `Successfully downloaded and selected ${downloadedGame.title}!`
            );
            
        } catch (error) {
            vscode.window.showErrorMessage(`Download failed: ${error}`);
        }
    });
}

export function deactivate() {
    if (gamePanel) {
        gamePanel.dispose();
        gamePanel = undefined;
    }
    
    if (cursorDetector) {
        cursorDetector.dispose();
        cursorDetector = undefined;
    }

    gameManager = undefined;
} 