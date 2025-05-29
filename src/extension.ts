import * as vscode from 'vscode';
import { GamePanel } from './gamePanel';
import { CursorDetector } from './cursorDetector';

let gamePanel: GamePanel | undefined;
let cursorDetector: CursorDetector | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('Ritalin extension is now active!');

    // Initialize the game panel
    gamePanel = new GamePanel(context.extensionUri);
    
    // Initialize the cursor detector
    cursorDetector = new CursorDetector();

    // Register commands
    const showGameCommand = vscode.commands.registerCommand('ritalin.showGame', () => {
        if (gamePanel) {
            gamePanel.show();
        }
    });

    const hideGameCommand = vscode.commands.registerCommand('ritalin.hideGame', () => {
        if (gamePanel) {
            gamePanel.hide();
        }
    });

    const toggleGameCommand = vscode.commands.registerCommand('ritalin.toggleGame', () => {
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

    // Set up cursor detection event handlers
    if (cursorDetector) {
        cursorDetector.onAiGenerationStart(() => {
            const config = vscode.workspace.getConfiguration('ritalin');
            const enabled = config.get<boolean>('enabled', true);
            const delay = config.get<number>('showDelay', 2000);

            if (enabled && gamePanel) {
                setTimeout(() => {
                    gamePanel?.show();
                }, delay);
            }
        });

        cursorDetector.onAiGenerationEnd(() => {
            if (gamePanel) {
                gamePanel.hide();
            }
        });
    }
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