import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { GameInfo } from './gameManager';

export interface WindowPreferences {
    enabled: boolean;
    position: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right' | 'center' | 'overlay' | 'custom';
    customX: number;
    customY: number;
    width: number;
    height: number;
    monitor: 'primary' | 'secondary' | 'auto';
    alwaysOnTop: boolean;
    hideOnBlur: boolean;
}

export interface MonitorInfo {
    id: number;
    x: number;
    y: number;
    width: number;
    height: number;
    isPrimary: boolean;
    isActive: boolean; // Monitor where Cursor is running
    cursorPoint?: {
        x: number;
        y: number;
    } | null;
}

export class GameWindowManager {
    private electronProcess: cp.ChildProcess | null = null;
    private extensionPath: string;
    private isReady: boolean = false;
    private messageQueue: any[] = [];
    private outputChannel: vscode.OutputChannel;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.extensionPath = context.extensionPath;
        this.outputChannel = vscode.window.createOutputChannel('Ritalin Window');
        this.outputChannel.appendLine('[GameWindowManager] Initialized');
        
        // Store context for later use
        this.context = context;
        
        // Check for electron on initialization
        this.checkElectronInstallation();
    }
    
    private getWindowPreferences(): WindowPreferences {
        const config = vscode.workspace.getConfiguration('ritalin.externalWindow');
        return {
            enabled: config.get<boolean>('enabled', false),
            position: config.get<'bottom-left' | 'bottom-right' | 'top-left' | 'top-right' | 'center' | 'overlay' | 'custom'>('position', 'bottom-left'),
            customX: config.get<number>('customX', 0),
            customY: config.get<number>('customY', 0),
            width: config.get<number>('width', 400),
            height: config.get<number>('height', 300),
            monitor: config.get<'primary' | 'secondary' | 'auto'>('monitor', 'primary'),
            alwaysOnTop: config.get<boolean>('alwaysOnTop', true),
            hideOnBlur: config.get<boolean>('hideOnBlur', false)
        };
    }
    
    private calculateWindowPosition(preferences: WindowPreferences, monitors: MonitorInfo[]): { x: number, y: number } {
        // Find the target monitor - prefer the active monitor (where Cursor likely is)
        let targetMonitor = monitors.find(m => m.isActive) || monitors.find(m => m.isPrimary); // Prefer active, fallback to primary
        
        if (preferences.monitor === 'secondary') {
            const secondaryMonitor = monitors.find(m => !m.isPrimary);
            if (secondaryMonitor) {
                targetMonitor = secondaryMonitor;
            }
        } else if (preferences.monitor === 'auto') {
            // Use the monitor with the most available space
            targetMonitor = monitors.reduce((largest, current) => 
                (current.width * current.height) > (largest.width * largest.height) ? current : largest
            );
        } else if (preferences.monitor === 'primary') {
            // Only override to primary if explicitly requested
            targetMonitor = monitors.find(m => m.isPrimary) || targetMonitor;
        }
        // For default case, we already prefer active monitor above
        
        if (!targetMonitor) {
            this.outputChannel.appendLine('[GameWindowManager] Warning: No target monitor found, using default positioning');
            return { x: 0, y: 0 };
        }

        this.outputChannel.appendLine(`[GameWindowManager] Using monitor: ${targetMonitor.id} (active: ${targetMonitor.isActive}, primary: ${targetMonitor.isPrimary})`);

        const monitor = targetMonitor;
        const { width: winWidth, height: winHeight } = preferences;
        
        // If we have Cursor's actual window position, use it for more precise positioning
        const cursorPoint = targetMonitor.cursorPoint;
        if (cursorPoint) {
            this.outputChannel.appendLine(`[GameWindowManager] Cursor point detected at: ${cursorPoint.x}, ${cursorPoint.y}`);
        }
        
        // Calculate position based on preference
        switch (preferences.position) {
            case 'bottom-left':
                // Position at bottom-left of the monitor where cursor/VS Code likely is
                return {
                    x: monitor.x + 60, // Offset from left edge to avoid sidebars
                    y: monitor.y + monitor.height - winHeight - 100 // Offset from bottom for taskbar/dock
                };
            case 'bottom-right':
                return {
                    x: monitor.x + monitor.width - winWidth - 60,
                    y: monitor.y + monitor.height - winHeight - 100
                };
            case 'top-left':
                return {
                    x: monitor.x + 60,
                    y: monitor.y + 80 // Offset for menu bar
                };
            case 'top-right':
                return {
                    x: monitor.x + monitor.width - winWidth - 60,
                    y: monitor.y + 80
                };
            case 'center':
                return {
                    x: monitor.x + (monitor.width - winWidth) / 2,
                    y: monitor.y + (monitor.height - winHeight) / 2
                };
            case 'overlay':
                // Overlay mode - position in center of the monitor where Cursor is
                // This creates a floating overlay effect
                return {
                    x: monitor.x + (monitor.width - winWidth) / 2,
                    y: monitor.y + (monitor.height - winHeight) / 2
                };
            case 'custom':
                return {
                    x: preferences.customX,
                    y: preferences.customY
                };
            default:
                // Default to bottom-left
                return {
                    x: monitor.x + 60,
                    y: monitor.y + monitor.height - winHeight - 100
                };
        }
    }
    
    private async getVSCodeWindowState(): Promise<any> {
        // VS Code doesn't directly expose window position, but we can use some tricks
        // We'll use the active text editor's visible ranges as a proxy for window focus
        const activeEditor = vscode.window.activeTextEditor;
        const workbenchConfig = vscode.workspace.getConfiguration('workbench');
        
        // Get some hints about the window state
        const state = {
            isFocused: vscode.window.state.focused,
            activeEditorColumn: activeEditor?.viewColumn,
            visibleEditors: vscode.window.visibleTextEditors.length,
            // We can't get exact window position, but we can make educated guesses
            // based on workspace configuration and active state
            workspaceFolder: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
            timestamp: Date.now()
        };
        
        return state;
    }
    
    private async checkElectronInstallation(): Promise<void> {
        this.outputChannel.appendLine('[GameWindowManager] Checking for electron installation...');
        
        // Use global storage path for persistent electron installation
        const globalStoragePath = this.context.globalStorageUri.fsPath;
        const electronPath = path.join(globalStoragePath, 'electron-cache', 'node_modules', 'electron');
        
        // Also check if electron exists in the extension's node_modules (for development)
        const extensionElectronPath = path.join(this.extensionPath, 'node_modules', 'electron');
        
        if (!fs.existsSync(electronPath) && !fs.existsSync(extensionElectronPath)) {
            this.outputChannel.appendLine('[GameWindowManager] Electron not found in global storage or extension');
            
            // Show a message to the user
            const result = await vscode.window.showInformationMessage(
                'Ritalin needs to install Electron for the external game window feature. This is a one-time setup that will persist across reloads.',
                'Install Now',
                'Later'
            );
            
            if (result === 'Install Now') {
                await this.installElectron();
            }
        } else {
            const foundPath = fs.existsSync(electronPath) ? electronPath : extensionElectronPath;
            this.outputChannel.appendLine('[GameWindowManager] Electron found at: ' + foundPath);
        }
    }
    
    private async installElectron(): Promise<void> {
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Installing Electron for Ritalin...',
            cancellable: false
        }, async (progress) => {
            try {
                progress.report({ message: 'Preparing installation directory...' });
                
                // Create electron cache directory in global storage
                const globalStoragePath = this.context.globalStorageUri.fsPath;
                const electronCachePath = path.join(globalStoragePath, 'electron-cache');
                
                // Ensure the directory exists
                if (!fs.existsSync(electronCachePath)) {
                    fs.mkdirSync(electronCachePath, { recursive: true });
                }
                
                // Create a minimal package.json for npm install
                const packageJsonPath = path.join(electronCachePath, 'package.json');
                if (!fs.existsSync(packageJsonPath)) {
                    fs.writeFileSync(packageJsonPath, JSON.stringify({
                        name: 'ritalin-electron-cache',
                        version: '1.0.0',
                        private: true
                    }, null, 2));
                }
                
                progress.report({ message: 'Running npm install electron...' });
                
                // Run npm install in the global storage directory
                await new Promise<void>((resolve, reject) => {
                    const npmProcess = cp.spawn('npm', ['install', 'electron@27.0.0', '--save'], {
                        cwd: electronCachePath,
                        shell: true
                    });
                    
                    npmProcess.stdout?.on('data', (data) => {
                        this.outputChannel.appendLine(`[npm] ${data.toString()}`);
                    });
                    
                    npmProcess.stderr?.on('data', (data) => {
                        this.outputChannel.appendLine(`[npm error] ${data.toString()}`);
                    });
                    
                    npmProcess.on('close', (code) => {
                        if (code === 0) {
                            this.outputChannel.appendLine('[GameWindowManager] Electron installed successfully in global storage');
                            resolve();
                        } else {
                            reject(new Error(`npm install failed with code ${code}`));
                        }
                    });
                });
                
                vscode.window.showInformationMessage('Electron installed successfully! This installation will persist across reloads.');
            } catch (error: any) {
                this.outputChannel.appendLine(`[GameWindowManager] Failed to install electron: ${error.message}`);
                vscode.window.showErrorMessage(`Failed to install Electron: ${error.message}`);
            }
        });
    }

    public async start(): Promise<void> {
        if (this.electronProcess) {
            this.outputChannel.appendLine('[GameWindowManager] Electron process already running');
            return; // Already running
        }
        
        // Check for electron in both locations
        const globalStoragePath = this.context.globalStorageUri.fsPath;
        const globalElectronPath = path.join(globalStoragePath, 'electron-cache', 'node_modules', 'electron');
        const extensionElectronPath = path.join(this.extensionPath, 'node_modules', 'electron');
        
        let electronPath: string | null = null;
        if (fs.existsSync(globalElectronPath)) {
            electronPath = globalElectronPath;
            this.outputChannel.appendLine('[GameWindowManager] Using Electron from global storage');
        } else if (fs.existsSync(extensionElectronPath)) {
            electronPath = extensionElectronPath;
            this.outputChannel.appendLine('[GameWindowManager] Using Electron from extension directory');
        }
        
        if (!electronPath) {
            this.outputChannel.appendLine('[GameWindowManager] Electron not installed, prompting user...');
            await this.checkElectronInstallation();
            
            // Check again after potential installation
            if (fs.existsSync(globalElectronPath)) {
                electronPath = globalElectronPath;
            } else if (fs.existsSync(extensionElectronPath)) {
                electronPath = extensionElectronPath;
            }
            
            if (!electronPath) {
                throw new Error('Electron is not installed. Please install it first.');
            }
        }

        const preferences = this.getWindowPreferences();
        this.outputChannel.appendLine(`[GameWindowManager] Window preferences: ${JSON.stringify(preferences)}`);
        
        // Get VS Code window state
        const windowState = await this.getVSCodeWindowState();
        this.outputChannel.appendLine(`[GameWindowManager] VS Code window state: ${JSON.stringify(windowState)}`);
        
        const runnerPath = path.join(this.extensionPath, 'electron-game-window', 'run-electron.js');
        
        this.outputChannel.appendLine('[GameWindowManager] Starting Electron game window...');
        this.outputChannel.appendLine(`[GameWindowManager] Runner path: ${runnerPath}`);
        this.outputChannel.appendLine(`[GameWindowManager] Electron path: ${electronPath}`);
        
        // Use the run-electron.js script which handles Electron spawning correctly
        this.electronProcess = cp.spawn('node', [runnerPath], {
            cwd: path.join(this.extensionPath, 'electron-game-window'),
            stdio: ['pipe', 'pipe', 'pipe'], // We can still pipe to our Node.js wrapper
            env: {
                ...process.env,
                // Ensure we're not in Node mode
                ELECTRON_RUN_AS_NODE: undefined,
                // Pass window preferences as environment variables
                RITALIN_WINDOW_PREFS: JSON.stringify(preferences),
                // Pass VS Code window state
                RITALIN_VSCODE_WINDOW: JSON.stringify(windowState),
                // Pass the electron path to use
                RITALIN_ELECTRON_PATH: electronPath
            }
        });

        // Since the Electron process uses stdio: 'inherit', we need to parse stdout for JSON messages
        this.electronProcess.stdout?.on('data', (data) => {
            const output = data.toString();
            const lines = output.split('\n');
            
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                    try {
                        const message = JSON.parse(trimmed);
                        if (message.type === 'ready') {
                            this.outputChannel.appendLine('[GameWindowManager] Electron window is ready');
                            this.isReady = true;
                            // Process any queued messages
                            this.processMessageQueue();
                        } else if (message.type === 'monitors') {
                            // Received monitor information from Electron
                            this.outputChannel.appendLine(`[GameWindowManager] Monitor info: ${JSON.stringify(message.monitors)}`);
                            
                            // Calculate and set window position
                            const position = this.calculateWindowPosition(preferences, message.monitors);
                            this.outputChannel.appendLine(`[GameWindowManager] Calculated position: ${JSON.stringify(position)}`);
                            this.setPosition(position.x, position.y);
                            this.setSize(preferences.width, preferences.height);
                        }
                    } catch (e) {
                        // Not JSON, just regular output
                    }
                }
                
                // Log non-JSON output for debugging
                if (trimmed && !trimmed.startsWith('{')) {
                    this.outputChannel.appendLine(`[Electron]: ${trimmed}`);
                }
            }
        });

        this.electronProcess.stderr?.on('data', (data) => {
            this.outputChannel.appendLine(`[Electron Error]: ${data.toString()}`);
        });

        this.electronProcess.on('error', (err) => {
            this.outputChannel.appendLine(`[GameWindowManager] Failed to start game window: ${err.message}`);
            vscode.window.showErrorMessage('Failed to start game window');
            this.electronProcess = null;
            this.isReady = false;
        });

        this.electronProcess.on('exit', (code) => {
            this.outputChannel.appendLine(`[GameWindowManager] Electron process exited with code: ${code}`);
            this.electronProcess = null;
            this.isReady = false;
        });

        // Wait a bit for the process to be ready
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    public show(): void {
        this.outputChannel.appendLine('[GameWindowManager] Show command called');
        this.sendCommand({ command: 'show' });
    }

    public hide(): void {
        this.outputChannel.appendLine('[GameWindowManager] Hide command called');
        this.sendCommand({ command: 'hide' });
    }

    public loadGame(game: GameInfo): void {
        // Use the game's entry point from the downloaded itch.io games
        const gamePath = game.entryPoint;
        this.outputChannel.appendLine(`[GameWindowManager] Loading game: ${game.title} from: ${gamePath}`);
        
        // Convert absolute path to file:// URL
        let gameUrl = gamePath;
        if (gamePath && !gamePath.startsWith('file://')) {
            gameUrl = 'file://' + gamePath;
        }
        
        this.outputChannel.appendLine(`[GameWindowManager] Game URL: ${gameUrl}`);
        this.sendCommand({ command: 'loadGame', gamePath: gameUrl });
    }

    public setPosition(x: number, y: number): void {
        this.sendCommand({ command: 'setPosition', x, y });
    }

    public setSize(width: number, height: number): void {
        this.sendCommand({ command: 'setSize', width, height });
    }

    public saveGameState(): void {
        this.outputChannel.appendLine('[GameWindowManager] Saving game state...');
        this.sendCommand({ command: 'saveGameState' });
    }

    public loadGameState(): void {
        this.outputChannel.appendLine('[GameWindowManager] Loading game state...');
        this.sendCommand({ command: 'loadGameState' });
    }

    public clearGameState(): void {
        this.outputChannel.appendLine('[GameWindowManager] Clearing game state...');
        this.sendCommand({ command: 'clearGameState' });
    }

    private sendCommand(message: any): void {
        if (!this.electronProcess) {
            this.outputChannel.appendLine('[GameWindowManager] Cannot send command - Electron process not running');
            return;
        }

        if (!this.isReady) {
            this.outputChannel.appendLine(`[GameWindowManager] Queueing message until Electron is ready: ${JSON.stringify(message)}`);
            this.messageQueue.push(message);
            return;
        }

        if (this.electronProcess.stdin) {
            const jsonMessage = JSON.stringify(message) + '\n';
            this.outputChannel.appendLine(`[GameWindowManager] Sending command to Electron: ${jsonMessage.trim()}`);
            this.electronProcess.stdin.write(jsonMessage);
        }
    }

    private processMessageQueue(): void {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.sendCommand(message);
        }
    }

    public dispose(): void {
        if (this.electronProcess) {
            this.sendCommand({ command: 'quit' });
            // Give it a moment to quit gracefully
            setTimeout(() => {
                if (this.electronProcess && !this.electronProcess.killed) {
                    this.electronProcess.kill();
                }
                this.electronProcess = null;
                this.isReady = false;
            }, 1000);
        }
        this.outputChannel.dispose();
    }
} 