import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { GameInfo } from './gameManager';

export class GameWindowManager {
    private electronProcess: cp.ChildProcess | null = null;
    private extensionPath: string;
    private isReady: boolean = false;
    private messageQueue: any[] = [];
    private outputChannel: vscode.OutputChannel;

    constructor(context: vscode.ExtensionContext) {
        this.extensionPath = context.extensionPath;
        this.outputChannel = vscode.window.createOutputChannel('Ritalin Game Window');
        
        // Register disposal
        context.subscriptions.push({
            dispose: () => this.dispose()
        });
    }

    public async start(): Promise<void> {
        if (this.electronProcess) {
            this.outputChannel.appendLine('Game window already running');
            return;
        }

        this.outputChannel.appendLine('Starting game window...');
        
        try {
            const appPath = path.join(this.extensionPath, 'electron-game-window');
            const runnerPath = path.join(appPath, 'run-electron.js');
            
            this.outputChannel.appendLine(`Using runner script to start Electron`);
            this.outputChannel.appendLine(`Runner path: ${runnerPath}`);
            this.outputChannel.appendLine(`App path: ${appPath}`);
            
            // Use node to run our electron runner script
            const nodePath = process.execPath;
            
            this.outputChannel.appendLine(`Spawning: ${nodePath} ${runnerPath}`);
            
            this.electronProcess = cp.spawn(nodePath, [runnerPath], {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' },
                cwd: appPath
            });
            
            this.outputChannel.appendLine(`Process spawned with PID: ${this.electronProcess.pid}`);

            // Handle stdout (messages from Electron)
            this.electronProcess.stdout?.on('data', (data) => {
                const output = data.toString();
                const messages = output.split('\n').filter((line: string) => line.trim());
                messages.forEach((message: string) => {
                    try {
                        const parsed = JSON.parse(message);
                        this.handleElectronMessage(parsed);
                    } catch (e) {
                        // Not JSON, could be npm install output or other info
                        if (!message.includes('npm') && !message.includes('packages')) {
                            this.outputChannel.appendLine(`Electron: ${message}`);
                        }
                    }
                });
            });

            // Handle stderr
            this.electronProcess.stderr?.on('data', (data) => {
                const output = data.toString();
                // Only log actual errors, not npm warnings
                if (!output.includes('npm warn')) {
                    this.outputChannel.appendLine(`Electron Error: ${output}`);
                }
            });

            // Handle process exit
            this.electronProcess.on('exit', (code) => {
                this.outputChannel.appendLine(`Electron process exited with code ${code}`);
                this.electronProcess = null;
                this.isReady = false;
            });

            // Handle process errors
            this.electronProcess.on('error', (err) => {
                this.outputChannel.appendLine(`Failed to start Electron: ${err.message}`);
                vscode.window.showErrorMessage(`Failed to start game window: ${err.message}`);
                this.electronProcess = null;
                this.isReady = false;
            });

            // Wait for ready signal
            await this.waitForReady();
            
        } catch (error: any) {
            this.outputChannel.appendLine(`Error starting game window: ${error.message}`);
            vscode.window.showErrorMessage(`Failed to start game window: ${error.message}`);
            throw error;
        }
    }



    private waitForReady(): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout waiting for game window to be ready'));
            }, 30000); // 30 seconds for initial Electron download

            const checkReady = setInterval(() => {
                if (this.isReady) {
                    clearInterval(checkReady);
                    clearTimeout(timeout);
                    resolve();
                }
            }, 100);
        });
    }

    private handleElectronMessage(message: any) {
        this.outputChannel.appendLine(`Received from Electron: ${JSON.stringify(message)}`);
        
        switch (message.type) {
            case 'ready':
                this.isReady = true;
                this.outputChannel.appendLine('Game window is ready');
                // Process queued messages
                this.messageQueue.forEach(msg => this.sendCommand(msg));
                this.messageQueue = [];
                break;
            case 'shown':
                this.outputChannel.appendLine('Game window shown');
                break;
            case 'hidden':
                this.outputChannel.appendLine('Game window hidden');
                break;
        }
    }

    public show(): void {
        this.sendCommand({ command: 'show' });
    }

    public hide(): void {
        this.sendCommand({ command: 'hide' });
    }

    public loadGame(game: GameInfo): void {
        // Use the game's entry point which is the full path to the game
        const gamePath = game.entryPoint;
        this.outputChannel.appendLine(`Loading game: ${game.title}`);
        this.outputChannel.appendLine(`Game path: ${gamePath}`);
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
            this.outputChannel.appendLine('Cannot send command: Electron process not running');
            return;
        }

        if (!this.isReady) {
            this.outputChannel.appendLine(`Queueing command: ${JSON.stringify(message)}`);
            this.messageQueue.push(message);
            return;
        }

        try {
            this.outputChannel.appendLine(`Sending command: ${JSON.stringify(message)}`);
            this.electronProcess.stdin?.write(JSON.stringify(message) + '\n');
        } catch (error: any) {
            this.outputChannel.appendLine(`Error sending command: ${error.message}`);
        }
    }

    public dispose(): void {
        this.outputChannel.appendLine('Disposing GameWindowManager');
        if (this.electronProcess) {
            this.sendCommand({ command: 'quit' });
            // Give it a moment to quit gracefully
            setTimeout(() => {
                if (this.electronProcess) {
                    this.electronProcess.kill();
                    this.electronProcess = null;
                }
            }, 1000);
        }
        this.outputChannel.dispose();
    }
} 