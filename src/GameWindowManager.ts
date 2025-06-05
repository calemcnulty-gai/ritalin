import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { GameInfo } from './gameManager';

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
                ELECTRON_RUN_AS_NODE: undefined
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
        this.sendCommand({ command: 'loadGame', gamePath });
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