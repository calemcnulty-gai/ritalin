import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { GameInfo } from './gameManager';

export interface WindowPreferences {
    enabled: boolean;
    position: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right' | 'center' | 'custom';
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
}

export class GameWindowManager {
    private electronProcess: cp.ChildProcess | null = null;
    private extensionPath: string;
    private isReady: boolean = false;
    private messageQueue: any[] = [];
    private outputChannel: vscode.OutputChannel;

    constructor(context: vscode.ExtensionContext) {
        this.extensionPath = context.extensionPath;
        this.outputChannel = vscode.window.createOutputChannel('Ritalin Window');
        this.outputChannel.appendLine('[GameWindowManager] Initialized');
        
        // Check for electron on initialization
        this.checkElectronInstallation();
    }
    
    private getWindowPreferences(): WindowPreferences {
        const config = vscode.workspace.getConfiguration('ritalin.externalWindow');
        return {
            enabled: config.get<boolean>('enabled', false),
            position: config.get<'bottom-left' | 'bottom-right' | 'top-left' | 'top-right' | 'center' | 'custom'>('position', 'bottom-left'),
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
        // Find the target monitor
        let targetMonitor = monitors.find(m => m.isPrimary); // Default to primary
        
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
        }
        
        if (!targetMonitor) {
            this.outputChannel.appendLine('[GameWindowManager] Warning: No target monitor found, using default positioning');
            return { x: 0, y: 0 };
        }
        
        const monitor = targetMonitor;
        const { width: winWidth, height: winHeight } = preferences;
        
        // Calculate position based on preference
        switch (preferences.position) {
            case 'bottom-left':
                return {
                    x: monitor.x + 20,
                    y: monitor.y + monitor.height - winHeight - 50
                };
            case 'bottom-right':
                return {
                    x: monitor.x + monitor.width - winWidth - 20,
                    y: monitor.y + monitor.height - winHeight - 50
                };
            case 'top-left':
                return {
                    x: monitor.x + 20,
                    y: monitor.y + 50
                };
            case 'top-right':
                return {
                    x: monitor.x + monitor.width - winWidth - 20,
                    y: monitor.y + 50
                };
            case 'center':
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
                return {
                    x: monitor.x + 20,
                    y: monitor.y + monitor.height - winHeight - 50
                };
        }
    }
    
    private async checkElectronInstallation(): Promise<void> {
        this.outputChannel.appendLine('[GameWindowManager] Checking for electron installation...');
        
        // Check if electron exists in the extension's node_modules
        const electronPath = path.join(this.extensionPath, 'node_modules', 'electron');
        
        if (!fs.existsSync(electronPath)) {
            this.outputChannel.appendLine('[GameWindowManager] Electron not found in extension node_modules');
            
            // Show a message to the user
            const result = await vscode.window.showInformationMessage(
                'Ritalin needs to install Electron for the external game window feature. This is a one-time setup.',
                'Install Now',
                'Later'
            );
            
            if (result === 'Install Now') {
                await this.installElectron();
            }
        } else {
            this.outputChannel.appendLine('[GameWindowManager] Electron found at: ' + electronPath);
        }
    }
    
    private async installElectron(): Promise<void> {
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Installing Electron for Ritalin...',
            cancellable: false
        }, async (progress) => {
            try {
                progress.report({ message: 'Running npm install electron...' });
                
                // Run npm install in the extension directory
                await new Promise<void>((resolve, reject) => {
                    const npmProcess = cp.spawn('npm', ['install', 'electron@27.0.0', '--no-save'], {
                        cwd: this.extensionPath,
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
                            this.outputChannel.appendLine('[GameWindowManager] Electron installed successfully');
                            resolve();
                        } else {
                            reject(new Error(`npm install failed with code ${code}`));
                        }
                    });
                });
                
                vscode.window.showInformationMessage('Electron installed successfully! You can now use the external game window.');
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
        
        // Check if electron is available before starting
        const electronPath = path.join(this.extensionPath, 'node_modules', 'electron');
        if (!fs.existsSync(electronPath)) {
            this.outputChannel.appendLine('[GameWindowManager] Electron not installed, prompting user...');
            await this.checkElectronInstallation();
            
            // If still not installed, abort
            if (!fs.existsSync(electronPath)) {
                throw new Error('Electron is not installed. Please install it first.');
            }
        }

        const preferences = this.getWindowPreferences();
        this.outputChannel.appendLine(`[GameWindowManager] Window preferences: ${JSON.stringify(preferences)}`);
        
        const runnerPath = path.join(this.extensionPath, 'electron-game-window', 'run-electron.js');
        
        this.outputChannel.appendLine('[GameWindowManager] Starting Electron game window...');
        this.outputChannel.appendLine(`[GameWindowManager] Runner path: ${runnerPath}`);
        
        // Use the run-electron.js script which handles Electron spawning correctly
        this.electronProcess = cp.spawn('node', [runnerPath], {
            cwd: path.join(this.extensionPath, 'electron-game-window'),
            stdio: ['pipe', 'pipe', 'pipe'], // We can still pipe to our Node.js wrapper
            env: {
                ...process.env,
                // Ensure we're not in Node mode
                ELECTRON_RUN_AS_NODE: undefined,
                // Pass window preferences as environment variables
                RITALIN_WINDOW_PREFS: JSON.stringify(preferences)
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