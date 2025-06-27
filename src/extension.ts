import * as vscode from 'vscode';
import { GameManager } from './gameManager';
import { GameInfo } from './types';
import { GameWindowManager } from './GameWindowManager';
import { CursorDetector } from './cursorDetector';
import { ConfigPanel } from './ConfigPanel';
import * as path from 'path';

let gameManager: GameManager;
let gameWindowManager: GameWindowManager;
let cursorDetector: CursorDetector;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('Ritalin');
    outputChannel.appendLine('[Ritalin] Extension activating...');

    // Create required Cursor files for AI detection (await properly)
    // Add a small delay to ensure workspace is fully loaded
    setTimeout(() => {
        createCursorFiles()
            .then(() => {
                outputChannel.appendLine('[Ritalin] ✅ Cursor files created successfully');
            })
            .catch((error: any) => {
                outputChannel.appendLine(`[Ritalin] ❌ Failed to create Cursor files: ${error}`);
                outputChannel.appendLine(`[Ritalin] Stack trace: ${error.stack || 'No stack trace'}`);
            });
    }, 1000); // 1 second delay

    gameManager = new GameManager(context, outputChannel);
    gameWindowManager = new GameWindowManager(context, outputChannel);
    cursorDetector = new CursorDetector(outputChannel);

    // Connect AI detection to game window management
    cursorDetector.onAiGenerationStart(() => {
        outputChannel.appendLine('[Ritalin] 🚀 AI generation detected - showing game window');
        const selectedGame = gameManager.getSelectedGame();
        
        if (selectedGame) {
            // Only load the game if it's not already loaded or has changed.
            if (gameWindowManager.getLoadedGameId() !== selectedGame.id) {
                outputChannel.appendLine(`[Ritalin] Loading new game: ${selectedGame.title}`);
                gameWindowManager.loadGame(selectedGame);
            } else {
                outputChannel.appendLine(`[Ritalin] Showing existing game: ${selectedGame.title}`);
            }
        }
        
        gameWindowManager.show();
    });

    cursorDetector.onAiGenerationEnd(() => {
        outputChannel.appendLine('[Ritalin] ⏸️ AI generation ended - hiding game window');
        gameWindowManager.hide();
    });

    // Show welcome page on first install/update
    const hasShownWelcome = context.globalState.get('ritalin.hasShownWelcomePageV1');
    outputChannel.appendLine(`[Ritalin] Has shown welcome page before: ${hasShownWelcome}`);
    
    if (hasShownWelcome === undefined) {
        outputChannel.appendLine('[Ritalin] First install detected, showing welcome page');
        // Delay slightly to ensure extension is fully loaded
        setTimeout(() => {
            ConfigPanel.createOrShow(context.extensionUri, gameManager, outputChannel);
            context.globalState.update('ritalin.hasShownWelcomePageV1', true);
        }, 500);
    }

    // Initialize managers
    gameManager.initialize().then(() => {
        // Preload the window and game content after the game manager is ready
        const selectedGame = gameManager.getSelectedGame();
        
        // Check if we have a selected game, if not and it's not first run, show config
        if (!selectedGame && hasShownWelcome !== undefined) {
            outputChannel.appendLine('[Ritalin] No game selected, showing configuration page');
            ConfigPanel.createOrShow(context.extensionUri, gameManager, outputChannel);
        }
        
        // Start the game window manager (this will auto-install Electron if needed)
        gameWindowManager.start().then(() => {
            outputChannel.appendLine('[Ritalin] Game window manager started successfully');
            
            // Preload selected game if available
            if (selectedGame) {
                gameWindowManager.preload(selectedGame).catch(error => {
                    outputChannel.appendLine(`[GameWindowManager] Preloading failed: ${error}`);
                });
            }
        }).catch(error => {
            outputChannel.appendLine(`[GameWindowManager] Startup failed: ${error}`);
            // If startup fails due to missing Electron, the installation prompt will have been shown
        });
    }).catch(error => {
        outputChannel.appendLine(`[GameManager] Initialization failed: ${error}`);
    });

    // --- COMMAND REGISTRATION ---
    context.subscriptions.push(
        vscode.commands.registerCommand('ritalin.manageGames', () => showGameManagementDialog()),
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

        // Create required Cursor files for new workspace
        createCursorFiles()
            .then(() => {
                outputChannel.appendLine('[Ritalin] ✅ Cursor files created for new workspace');
            })
            .catch((error: any) => {
                outputChannel.appendLine(`[Ritalin] ❌ Failed to create Cursor files for new workspace: ${error}`);
                outputChannel.appendLine(`[Ritalin] Stack trace: ${error.stack || 'No stack trace'}`);
            });

        gameManager = new GameManager(context, outputChannel);
        gameWindowManager = new GameWindowManager(context, outputChannel);
        cursorDetector = new CursorDetector(outputChannel);
        
        // Reconnect AI detection to game window management after workspace change
        cursorDetector.onAiGenerationStart(() => {
            outputChannel.appendLine('[Ritalin] 🚀 AI generation detected - showing game window');
            const selectedGame = gameManager.getSelectedGame();
            if (selectedGame) {
                gameWindowManager.loadGame(selectedGame);
            }
            gameWindowManager.show();
        });

        cursorDetector.onAiGenerationEnd(() => {
            outputChannel.appendLine('[Ritalin] ⏸️ AI generation ended - hiding game window');
            gameWindowManager.hide();
        });
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
}

// Utility to ensure .gitignore contains required entries
async function ensureGitignoreHasCursorFiles(workspaceFolder: vscode.Uri) {
    const gitignorePath = vscode.Uri.joinPath(workspaceFolder, '.gitignore');
    let gitignoreContent = '';
    let exists = true;
    try {
        const content = await vscode.workspace.fs.readFile(gitignorePath);
        gitignoreContent = content.toString();
    } catch (err) {
        if (err instanceof vscode.FileSystemError && err.code === 'FileNotFound') {
            exists = false;
        } else {
            throw err;
        }
    }
    const lines = gitignoreContent.split(/\r?\n/);
    const needed = ['.cursor/is_working', '.cursor/rules/ai-activity-reporting.mdc'];
    let changed = false;
    for (const entry of needed) {
        if (!lines.some(line => line.trim() === entry)) {
            lines.push(entry);
            changed = true;
        }
    }
    if (changed || !exists) {
        const newContent = lines.filter(Boolean).join('\n') + '\n';
        await vscode.workspace.fs.writeFile(gitignorePath, Buffer.from(newContent, 'utf8'));
        outputChannel.appendLine('[Ritalin] Updated .gitignore with .cursor files');
    }
}

async function createCursorFiles(): Promise<void> {
    outputChannel.appendLine('[Ritalin] Starting cursor files creation...');
    
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        throw new Error('No workspace folder found');
    }

    outputChannel.appendLine(`[Ritalin] Workspace folder: ${workspaceFolder.uri.fsPath}`);

    const cursorDir = vscode.Uri.joinPath(workspaceFolder.uri, '.cursor');
    const rulesDir = vscode.Uri.joinPath(cursorDir, 'rules');
    const isWorkingFile = vscode.Uri.joinPath(cursorDir, 'is_working');
    const aiActivityRuleFile = vscode.Uri.joinPath(rulesDir, 'ai-activity-reporting.mdc');

    outputChannel.appendLine(`[Ritalin] Target paths:`);
    outputChannel.appendLine(`  .cursor dir: ${cursorDir.fsPath}`);
    outputChannel.appendLine(`  rules dir: ${rulesDir.fsPath}`);
    outputChannel.appendLine(`  is_working file: ${isWorkingFile.fsPath}`);
    outputChannel.appendLine(`  rule file: ${aiActivityRuleFile.fsPath}`);

    try {
        // Create .cursor directory
        outputChannel.appendLine('[Ritalin] Creating .cursor directory...');
        try {
            await vscode.workspace.fs.createDirectory(cursorDir);
            outputChannel.appendLine('[Ritalin] ✅ .cursor directory created');
        } catch (error) {
            if (error instanceof vscode.FileSystemError && error.code === 'FileExists') {
                outputChannel.appendLine('[Ritalin] ✅ .cursor directory already exists');
            } else {
                throw error;
            }
        }
        
        // Create .cursor/rules directory
        outputChannel.appendLine('[Ritalin] Creating .cursor/rules directory...');
        try {
            await vscode.workspace.fs.createDirectory(rulesDir);
            outputChannel.appendLine('[Ritalin] ✅ .cursor/rules directory created');
        } catch (error) {
            if (error instanceof vscode.FileSystemError && error.code === 'FileExists') {
                outputChannel.appendLine('[Ritalin] ✅ .cursor/rules directory already exists');
            } else {
                throw error;
            }
        }

        // Create .cursor/is_working file if it doesn't exist
        outputChannel.appendLine('[Ritalin] Checking/creating is_working file...');
        let createdIsWorking = false;
        try {
            await vscode.workspace.fs.stat(isWorkingFile);
            outputChannel.appendLine('[Ritalin] ✅ is_working file already exists');
        } catch (error) {
            if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
                // File doesn't exist, create it with initial value
                await vscode.workspace.fs.writeFile(isWorkingFile, Buffer.from('false', 'utf8'));
                outputChannel.appendLine('[Ritalin] ✅ Created .cursor/is_working file with initial value "false"');
                createdIsWorking = true;
            } else {
                throw error;
            }
        }

        // Create .cursor/rules/ai-activity-reporting.mdc file if it doesn't exist
        outputChannel.appendLine('[Ritalin] Checking/creating ai-activity-reporting.mdc file...');
        let createdRule = false;
        try {
            await vscode.workspace.fs.stat(aiActivityRuleFile);
            outputChannel.appendLine('[Ritalin] ✅ ai-activity-reporting.mdc file already exists');
        } catch (error) {
            if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
                // File doesn't exist, create it with the rule content
                const ruleContent = `---\ndescription: \nglobs: \nalwaysApply: true\n---\n# AI Activity Self-Reporting Rule\n\n## Core Instruction\n\n**CRITICAL**: You MUST follow this rule for ALL interactions to enable the Ritalin extension to detect your activity and show games during AI generation.\n\n### When Starting ANY Task or Response\n\nBefore you begin thinking, working on, or responding to any user prompt, you MUST first edit the file \`.cursor/is_working\` to contain exactly:\n\n\`\`\`\ntrue\n\`\`\`\n\n### When Waiting for ANY User Input\n\nSet \`.cursor/is_working\` to \`false\` in these situations:\n- **After completing your response** and waiting for the next user input\n- **When waiting for user approval** to run a terminal command\n- **When asking for clarification** or additional information\n- **When prompting user to choose** between options\n- **Any time you are paused** waiting for human interaction\n\n## Implementation Details\n\n- **File Location**: \`.cursor/is_working\` (relative to workspace root)\n- **Content Format**: \n  - Working/Thinking: \`true\` (no quotes, no extra text)\n  - Waiting/Idle: \`false\` (no quotes, no extra text)\n- **Timing**: \n  - Set to \`true\` BEFORE you start any thinking or generation\n  - Set to \`false\` IMMEDIATELY when waiting for user input\n- **Always Required**: This applies to ALL interactions, regardless of complexity\n\n## Examples\n\n**When starting any task:**\n1. First action: Edit \`.cursor/is_working\` → \`true\`\n2. Then: Begin your normal thinking and response process\n\n**When waiting for terminal command approval:**\n1. Complete your response with the terminal command proposal\n2. Immediately: Edit \`.cursor/is_working\` → \`false\`\n3. Wait for user approval\n\n**When asking for clarification:**\n1. Complete your clarifying question\n2. Immediately: Edit \`.cursor/is_working\` → \`false\`\n3. Wait for user response\n\n## Purpose\n\nThis enables the Ritalin extension to:\n- Detect AI activity reliably \n- Show games during AI generation periods\n- Hide games when waiting for user input\n- Provide seamless integration between AI work and user break time\n\n## Critical Notes\n\n- **Never skip this step** - even for simple responses\n- **File must contain only the boolean value** - no extra formatting\n- **Use exact text**: \`true\` or \`false\` (lowercase, no quotes)\n- **Edit the file, don't just reference it** - the extension watches for file changes\n- **Always set to false when waiting** - don't leave it as true during user wait periods\n`;
                await vscode.workspace.fs.writeFile(aiActivityRuleFile, Buffer.from(ruleContent, 'utf8'));
                outputChannel.appendLine('[Ritalin] ✅ Created .cursor/rules/ai-activity-reporting.mdc file');
                createdRule = true;
            } else {
                throw error;
            }
        }

        // Ensure .gitignore has the required entries if either file was created
        if (createdIsWorking || createdRule) {
            await ensureGitignoreHasCursorFiles(workspaceFolder.uri);
        }

        outputChannel.appendLine('[Ritalin] ✅ All cursor files creation completed successfully');

    } catch (error) {
        outputChannel.appendLine(`[Ritalin] ❌ Error during cursor files creation: ${error}`);
        throw error;
    }
}