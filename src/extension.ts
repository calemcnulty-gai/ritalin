import * as vscode from 'vscode';
import { GamePanelViewProvider } from './gamePanelView';
import { CursorDetector } from './cursorDetector';
import { GameManager, GameInfo } from './gameManager';
import { GameWindowManager } from './GameWindowManager';

let gamePanelViewProvider: GamePanelViewProvider | undefined;
let cursorDetector: CursorDetector | undefined;
let gameManager: GameManager | undefined;
let gameWindowManager: GameWindowManager | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('[Ritalin] Extension is now activating!');
    console.log('[Ritalin] Extension URI:', context.extensionUri.toString());
    console.log('[Ritalin] Global Storage Path:', context.globalStorageUri?.fsPath);

    // Initialize the WebviewView provider for bottom panel
    console.log('[Ritalin] Initializing GamePanelViewProvider...');
    gamePanelViewProvider = new GamePanelViewProvider(context.extensionUri, context);
    
    // Register the webview view provider
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            GamePanelViewProvider.viewType,
            gamePanelViewProvider
        )
    );
    
    // Initialize the cursor detector
    console.log('[Ritalin] Initializing CursorDetector...');
    cursorDetector = new CursorDetector();

    // Initialize the game manager
    console.log('[Ritalin] Initializing GameManager...');
    gameManager = new GameManager(context);

    // Initialize the game window manager
    console.log('[Ritalin] Initializing GameWindowManager...');
    gameWindowManager = new GameWindowManager(context);

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
        if (selectedGame) {
            console.log('[Ritalin] Loading selected game:', selectedGame.title);
            console.log('[Ritalin] Game entry point:', selectedGame.entryPoint);
            
            if (gamePanelViewProvider) {
                gamePanelViewProvider.loadGame(selectedGame);
            }
        } else {
            console.log('[Ritalin] No selected game found');
        }
    }).catch(error => {
        console.error('[Ritalin] GameManager initialization failed:', error);
    });

    // Helper functions
    const showGame = () => {
        if (gamePanelViewProvider) {
            gamePanelViewProvider.show();
            // Ensure the panel area is visible
            vscode.commands.executeCommand('workbench.action.focusPanel');
            // Focus on the Ritalin game view specifically
            vscode.commands.executeCommand('ritalin.gameView.focus');
            
            // Show a helpful tip about resizing (only once per session)
            const config = vscode.workspace.getConfiguration('ritalin');
            const showResizeTip = config.get<boolean>('showResizeTip', true);
            const hasShownTip = context.globalState.get('ritalin.hasShownResizeTip', false);
            
            if (showResizeTip && !hasShownTip) {
                vscode.window.showInformationMessage(
                    'Tip: Drag the panel border up to make the game area larger!',
                    'Got it'
                ).then(selection => {
                    if (selection === 'Got it') {
                        context.globalState.update('ritalin.hasShownResizeTip', true);
                    }
                });
            }
        }
    };

    const hideGame = () => {
        if (gamePanelViewProvider) {
            // Since WebviewView doesn't support hiding, we'll close the entire panel
            vscode.commands.executeCommand('workbench.action.closePanel');
        }
    };

    const toggleGame = () => {
        // Check if panel is visible
        vscode.commands.executeCommand('workbench.action.togglePanel');
    };

    const loadGameIntoPanel = (game: GameInfo) => {
        if (gamePanelViewProvider) {
            gamePanelViewProvider.loadGame(game);
        }
    };

    // Register commands
    console.log('[Ritalin] Registering commands...');
    
    // Add explicit preload command for debugging
    const preloadGameCommand = vscode.commands.registerCommand('ritalin.preloadGame', async () => {
        console.log('[Ritalin] Preload game command triggered');
        
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
        console.log('[Ritalin] Panel ready:', !!gamePanelViewProvider);
        console.log('[Ritalin] GameManager exists:', !!gameManager);
        
        // Show status in notification
        const statusMessage = `
Debug Status:
- Panel type: WebviewView (Bottom Panel)
- Downloaded games: ${downloadedGames.length}
- Selected game: ${selectedGame?.title || 'None'}
- Panel ready: ${!!gamePanelViewProvider}
- Manager ready: ${!!gameManager}
        `.trim();
        
        vscode.window.showInformationMessage(statusMessage, { modal: false });
        
        // If we have a selected game, preload it
        if (selectedGame) {
            console.log('[Ritalin] Preloading selected game:', selectedGame.title);
            console.log('[Ritalin] Game entry point:', selectedGame.entryPoint);
            console.log('[Ritalin] Game is downloaded:', selectedGame.isDownloaded);
            
            if (gamePanelViewProvider) {
                gamePanelViewProvider.loadGame(selectedGame);
                vscode.window.showInformationMessage(`Preloaded in panel: ${selectedGame.title}`);
            }
        } else if (!selectedGame) {
            console.log('[Ritalin] No game selected for preload');
            vscode.window.showWarningMessage('No game selected. Use "Search itch.io Games" to download a game first.');
        } else {
            console.log('[Ritalin] Cannot preload - Panel not available');
            vscode.window.showErrorMessage('Panel not available. Extension may not be fully initialized.');
        }
    });
    
    const showGameCommand = vscode.commands.registerCommand('ritalin.showGame', () => {
        console.log('[Ritalin] Show game command triggered');
        showGame();
    });

    const hideGameCommand = vscode.commands.registerCommand('ritalin.hideGame', () => {
        console.log('[Ritalin] Hide game command triggered');
        hideGame();
    });

    const toggleGameCommand = vscode.commands.registerCommand('ritalin.toggleGame', () => {
        console.log('[Ritalin] Toggle game command triggered');
        toggleGame();
    });

    const searchGamesCommand = vscode.commands.registerCommand('ritalin.searchGames', async () => {
        console.log('[Ritalin] Search games command triggered');
        await showGameSearchDialog(loadGameIntoPanel);
    });

    const manageGamesCommand = vscode.commands.registerCommand('ritalin.manageGames', async () => {
        console.log('[Ritalin] Manage games command triggered');
        await showGameManagementDialog(loadGameIntoPanel);
    });

    const openSettingsCommand = vscode.commands.registerCommand('ritalin.openSettings', () => {
        console.log('[Ritalin] Open settings command triggered');
        vscode.commands.executeCommand('workbench.action.openSettings', 'ritalin');
    });

    // Test command for external game window
    const testExternalWindowCommand = vscode.commands.registerCommand('ritalin.testExternalWindow', async () => {
        console.log('[Ritalin] Test external window command triggered');
        vscode.window.showInformationMessage('Test external window command triggered!');
        
        if (!gameWindowManager || !gameManager) {
            console.error('[Ritalin] Game window manager or game manager not initialized');
            vscode.window.showErrorMessage('Game window manager or game manager not initialized');
            return;
        }
        
        const selectedGame = gameManager.getSelectedGame();
        if (!selectedGame) {
            console.warn('[Ritalin] No game selected');
            vscode.window.showWarningMessage('No game selected. Use "Search itch.io Games" to download a game first.');
            return;
        }
        
        try {
            console.log('[Ritalin] Starting game window manager...');
            await gameWindowManager.start();
            console.log('[Ritalin] Showing game window...');
            gameWindowManager.show();
            console.log('[Ritalin] Loading game:', selectedGame.title);
            gameWindowManager.loadGame(selectedGame);
            vscode.window.showInformationMessage(`External game window opened with ${selectedGame.title}!`);
        } catch (error: any) {
            console.error('[Ritalin] Error opening game window:', error);
            vscode.window.showErrorMessage(`Failed to open game window: ${error.message}`);
        }
    });

    // Configuration command for external window
    const configureExternalWindowCommand = vscode.commands.registerCommand('ritalin.configureExternalWindow', async () => {
        console.log('[Ritalin] Configure external window command triggered');
        await showExternalWindowConfigDialog();
    });

    // Add to subscriptions for cleanup
    context.subscriptions.push(
        preloadGameCommand,
        showGameCommand,
        hideGameCommand,
        toggleGameCommand,
        searchGamesCommand,
        manageGamesCommand,
        openSettingsCommand,
        testExternalWindowCommand,
        configureExternalWindowCommand
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

            if (enabled) {
                console.log('[Ritalin] Showing game after delay...');
                setTimeout(() => {
                    showGame();
                }, delay);
            }
        });

        cursorDetector.onAiGenerationEnd(() => {
            console.log('[Ritalin] AI generation ended - hiding game');
            hideGame();
        });
    }

    console.log('[Ritalin] Extension activation complete!');
}

async function showGameSearchDialog(loadGameIntoPanel: (game: GameInfo) => void): Promise<void> {
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
                await downloadAndSelectGame(selected.game, loadGameIntoPanel);
            } else if (selected && selected.game.isDownloaded) {
                await gameManager!.setSelectedGame(selected.game.id);
                vscode.window.showInformationMessage(`Selected ${selected.game.title} as default game`);
                
                // Load the game into the panel
                loadGameIntoPanel(selected.game);
            }

        } catch (error) {
            vscode.window.showErrorMessage(`Search failed: ${error}`);
        }
    });
}

async function showGameManagementDialog(loadGameIntoPanel: (game: GameInfo) => void): Promise<void> {
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
            await showGameSearchDialog(loadGameIntoPanel);
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
        await showGameSearchDialog(loadGameIntoPanel);
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
                
                // Load the game into the panel
                loadGameIntoPanel(selected.game);
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

async function downloadAndSelectGame(game: GameInfo, loadGameIntoPanel: (game: GameInfo) => void): Promise<void> {
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
            
            // Load the game into the panel
            loadGameIntoPanel(downloadedGame);
            
        } catch (error) {
            vscode.window.showErrorMessage(`Download failed: ${error}`);
        }
    });
}

async function showExternalWindowConfigDialog(): Promise<void> {
    const config = vscode.workspace.getConfiguration('ritalin.externalWindow');
    
    // Main configuration menu
    const configOptions = [
        { 
            label: '$(window) Enable External Window', 
            description: config.get<boolean>('enabled') ? '✓ Enabled' : 'Disabled',
            action: 'toggle-enabled' 
        },
        { 
            label: '$(location) Window Position', 
            description: `Currently: ${config.get<string>('position', 'bottom-right')}`,
            action: 'position' 
        },
        { 
            label: '$(expand) Window Size', 
            description: `${config.get<number>('width', 400)}x${config.get<number>('height', 300)}`,
            action: 'size' 
        },
        { 
            label: '$(desktop-download) Monitor Selection', 
            description: `Currently: ${config.get<string>('monitor', 'primary')}`,
            action: 'monitor' 
        },
        { 
            label: '$(pin) Always On Top', 
            description: config.get<boolean>('alwaysOnTop') ? '✓ Enabled' : 'Disabled',
            action: 'toggle-ontop' 
        },
        { 
            label: '$(eye-closed) Hide On Blur', 
            description: config.get<boolean>('hideOnBlur') ? '✓ Enabled' : 'Disabled',
            action: 'toggle-blur' 
        },
        { 
            label: '$(play) Test Window', 
            description: 'Open test window with current settings',
            action: 'test' 
        }
    ];

    const selected = await vscode.window.showQuickPick(configOptions, {
        title: 'Configure External Game Window',
        placeHolder: 'Select a setting to configure'
    });

    if (!selected) {
        return;
    }

    try {
        switch (selected.action) {
            case 'toggle-enabled':
                const currentEnabled = config.get<boolean>('enabled', false);
                await config.update('enabled', !currentEnabled, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage(`External window ${!currentEnabled ? 'enabled' : 'disabled'}`);
                break;

            case 'position':
                await configurePosition();
                break;

            case 'size':
                await configureSize();
                break;

            case 'monitor':
                await configureMonitor();
                break;

            case 'toggle-ontop':
                const currentOnTop = config.get<boolean>('alwaysOnTop', true);
                await config.update('alwaysOnTop', !currentOnTop, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage(`Always on top ${!currentOnTop ? 'enabled' : 'disabled'}`);
                break;

            case 'toggle-blur':
                const currentBlur = config.get<boolean>('hideOnBlur', false);
                await config.update('hideOnBlur', !currentBlur, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage(`Hide on blur ${!currentBlur ? 'enabled' : 'disabled'}`);
                break;

            case 'test':
                vscode.commands.executeCommand('ritalin.testExternalWindow');
                break;
        }
    } catch (error: any) {
        vscode.window.showErrorMessage(`Configuration failed: ${error.message}`);
    }
}

async function configurePosition(): Promise<void> {
    const config = vscode.workspace.getConfiguration('ritalin.externalWindow');
    
    const positions = [
        { label: 'Bottom Left', value: 'bottom-left' },
        { label: 'Bottom Right', value: 'bottom-right' },
        { label: 'Top Left', value: 'top-left' },
        { label: 'Top Right', value: 'top-right' },
        { label: 'Center', value: 'center' },
        { label: 'Custom Position', value: 'custom' }
    ];

    const selected = await vscode.window.showQuickPick(positions, {
        title: 'Select Window Position',
        placeHolder: 'Choose where to place the external window'
    });

    if (!selected) {
        return;
    }

    await config.update('position', selected.value, vscode.ConfigurationTarget.Global);

    if (selected.value === 'custom') {
        const x = await vscode.window.showInputBox({
            prompt: 'Enter X position (pixels from left edge)',
            value: config.get<number>('customX', 0).toString(),
            validateInput: (value) => {
                const num = parseInt(value);
                return isNaN(num) ? 'Please enter a valid number' : null;
            }
        });

        const y = await vscode.window.showInputBox({
            prompt: 'Enter Y position (pixels from top edge)',
            value: config.get<number>('customY', 0).toString(),
            validateInput: (value) => {
                const num = parseInt(value);
                return isNaN(num) ? 'Please enter a valid number' : null;
            }
        });

        if (x && y) {
            await config.update('customX', parseInt(x), vscode.ConfigurationTarget.Global);
            await config.update('customY', parseInt(y), vscode.ConfigurationTarget.Global);
        }
    }

    vscode.window.showInformationMessage(`Window position set to: ${selected.label}`);
}

async function configureSize(): Promise<void> {
    const config = vscode.workspace.getConfiguration('ritalin.externalWindow');
    
    const width = await vscode.window.showInputBox({
        prompt: 'Enter window width (200-1200 pixels)',
        value: config.get<number>('width', 400).toString(),
        validateInput: (value) => {
            const num = parseInt(value);
            if (isNaN(num)) return 'Please enter a valid number';
            if (num < 200 || num > 1200) return 'Width must be between 200 and 1200 pixels';
            return null;
        }
    });

    const height = await vscode.window.showInputBox({
        prompt: 'Enter window height (150-800 pixels)',
        value: config.get<number>('height', 300).toString(),
        validateInput: (value) => {
            const num = parseInt(value);
            if (isNaN(num)) return 'Please enter a valid number';
            if (num < 150 || num > 800) return 'Height must be between 150 and 800 pixels';
            return null;
        }
    });

    if (width && height) {
        await config.update('width', parseInt(width), vscode.ConfigurationTarget.Global);
        await config.update('height', parseInt(height), vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Window size set to: ${width}x${height}`);
    }
}

async function configureMonitor(): Promise<void> {
    const config = vscode.workspace.getConfiguration('ritalin.externalWindow');
    
    const monitors = [
        { label: 'Primary Monitor', value: 'primary' },
        { label: 'Secondary Monitor', value: 'secondary' },
        { label: 'Auto (Largest)', value: 'auto' }
    ];

    const selected = await vscode.window.showQuickPick(monitors, {
        title: 'Select Monitor',
        placeHolder: 'Choose which monitor to place the window on'
    });

    if (selected) {
        await config.update('monitor', selected.value, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Monitor selection set to: ${selected.label}`);
    }
}

export function deactivate() {
    // GamePanelViewProvider doesn't need explicit disposal
    // It's handled by VS Code when the view is unregistered
    gamePanelViewProvider = undefined;
    
    if (cursorDetector) {
        cursorDetector.dispose();
        cursorDetector = undefined;
    }

    gameManager = undefined;
} 