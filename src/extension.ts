import * as vscode from 'vscode';
import { GamePanel } from './gamePanel';
import { CursorDetector } from './cursorDetector';

let gamePanel: GamePanel | undefined;
let cursorDetector: CursorDetector | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('[Ritalin] Extension is now activating!');
    console.log('[Ritalin] Extension URI:', context.extensionUri.toString());

    // Initialize the game panel
    console.log('[Ritalin] Initializing GamePanel...');
    gamePanel = new GamePanel(context.extensionUri);
    
    // Initialize the cursor detector
    console.log('[Ritalin] Initializing CursorDetector...');
    cursorDetector = new CursorDetector();

    // Register commands
    console.log('[Ritalin] Registering commands...');
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

    // Add to subscriptions for cleanup
    context.subscriptions.push(
        showGameCommand,
        hideGameCommand,
        toggleGameCommand
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

export function deactivate() {
    if (gamePanel) {
        gamePanel.dispose();
        gamePanel = undefined;
    }
    
    if (cursorDetector) {
        cursorDetector.dispose();
        cursorDetector = undefined;
    }
} 