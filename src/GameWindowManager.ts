import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { GameInfo } from './types';

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
    private isStarting: boolean = false;
    private extensionPath: string;
    private isReady: boolean = false;
    private messageQueue: any[] = [];
    private outputChannel: vscode.OutputChannel;
    private context: vscode.ExtensionContext;
    private hasSizedWindow: boolean = false; // Track if window has been explicitly sized
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private currentlyLoadedGameId: string | null = null;

    constructor(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
        this.extensionPath = context.extensionPath;
        this.outputChannel = outputChannel;
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
            width: config.get<number>('width') || 800, // Fallback to reasonable default if not set
            height: config.get<number>('height') || 600, // Fallback to reasonable default if not set
            monitor: config.get<'primary' | 'secondary' | 'auto'>('monitor', 'primary'),
            alwaysOnTop: config.get<boolean>('alwaysOnTop', true),
            hideOnBlur: config.get<boolean>('hideOnBlur', false)
        };
    }
    
    private isUsingDefaultDimensions(): boolean {
        const config = vscode.workspace.getConfiguration('ritalin.externalWindow');
        const currentWidth = config.get<number>('width');
        const currentHeight = config.get<number>('height');
        
        // User is using defaults if width and height are not explicitly configured
        return currentWidth === undefined && currentHeight === undefined;
    }
    
    private getGameDimensions(game: GameInfo): { width: number, height: number } | null {
        if (game.width && game.height) {
            // Validate dimensions are reasonable
            if (game.width >= 200 && game.width <= 1200 && 
                game.height >= 150 && game.height <= 800) {
                return { width: game.width, height: game.height };
            }
        }
        return null;
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
            
            // Auto-install Electron without prompting
            vscode.window.showInformationMessage(
                'Ritalin is installing Electron for the game window feature. This is a one-time setup...'
            );
            
            await this.installElectron();
        } else {
            const foundPath = fs.existsSync(electronPath) ? electronPath : extensionElectronPath;
            this.outputChannel.appendLine('[GameWindowManager] Electron found at: ' + foundPath);
        }
    }
    
    private async installElectron(): Promise<void> {
        // First check if npm is available
        try {
            await new Promise<void>((resolve, reject) => {
                cp.exec('npm --version', (error, stdout) => {
                    if (error) {
                        reject(new Error('npm is not installed or not in PATH'));
                    } else {
                        this.outputChannel.appendLine(`[GameWindowManager] npm version: ${stdout.trim()}`);
                        resolve();
                    }
                });
            });
        } catch (error: any) {
            this.outputChannel.appendLine(`[GameWindowManager] npm check failed: ${error.message}`);
            vscode.window.showErrorMessage(
                'npm is required to install Electron. Please install Node.js/npm and restart VS Code.',
                'Open Node.js Website'
            ).then(selection => {
                if (selection === 'Open Node.js Website') {
                    vscode.env.openExternal(vscode.Uri.parse('https://nodejs.org/'));
                }
            });
            throw error;
        }

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
                    let npmOutput = '';
                    let npmError = '';
                    
                    const npmProcess = cp.spawn('npm', ['install', 'electron@27.0.0', '--save'], {
                        cwd: electronCachePath,
                        shell: true
                    });
                    
                    npmProcess.stdout?.on('data', (data) => {
                        npmOutput += data.toString();
                        this.outputChannel.appendLine(`[npm] ${data.toString()}`);
                    });
                    
                    npmProcess.stderr?.on('data', (data) => {
                        npmError += data.toString();
                        this.outputChannel.appendLine(`[npm error] ${data.toString()}`);
                    });
                    
                    npmProcess.on('close', (code) => {
                        // Check if Electron was actually installed despite the error
                        const electronPath = path.join(electronCachePath, 'node_modules', 'electron');
                        const electronExecutable = path.join(electronPath, 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron');
                        
                        if (fs.existsSync(electronPath) && (fs.existsSync(electronExecutable) || fs.existsSync(path.join(electronPath, 'dist', 'electron.exe')) || fs.existsSync(path.join(electronPath, 'dist', 'electron')))) {
                            this.outputChannel.appendLine('[GameWindowManager] Electron installed successfully in global storage (verified by checking executable)');
                            resolve();
                        } else if (code === 0) {
                            this.outputChannel.appendLine('[GameWindowManager] Electron installed successfully in global storage');
                            resolve();
                        } else {
                            // Check if the error is just about symlinks but packages were added
                            if (npmOutput.includes('added') && npmOutput.includes('packages') && npmError.includes('EEXIST')) {
                                this.outputChannel.appendLine('[GameWindowManager] Electron installation completed despite symlink errors');
                                resolve();
                            } else {
                                reject(new Error(`npm install failed with code ${code}`));
                            }
                        }
                    });
                });
                
                vscode.window.showInformationMessage('Electron installed successfully! The game window is now ready.');
            } catch (error: any) {
                this.outputChannel.appendLine(`[GameWindowManager] Failed to install electron: ${error.message}`);
                
                // Check one more time if Electron is actually there despite the error
                const globalStoragePath = this.context.globalStorageUri.fsPath;
                const electronPath = path.join(globalStoragePath, 'electron-cache', 'node_modules', 'electron');
                
                if (fs.existsSync(electronPath)) {
                    this.outputChannel.appendLine('[GameWindowManager] Electron found despite installation error, continuing...');
                    vscode.window.showInformationMessage('Electron is ready! (recovered from installation error)');
                } else {
                    vscode.window.showErrorMessage(`Failed to install Electron: ${error.message}`);
                    throw error;
                }
            }
        });
    }

    public async start(): Promise<void> {
        if (this.electronProcess || this.isStarting) {
            this.outputChannel.appendLine('[GameWindowManager] Electron process already running or starting.');
            return; // Already running or in the process of starting
        }

        this.isStarting = true;

        try {
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
                    // Set NODE_ENV to development for faster heartbeat
                    NODE_ENV: 'development',
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

            this.startHeartbeat();

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
                                
                                // Set initial size only if window hasn't been explicitly sized yet
                                // This provides a reasonable starting size before games are loaded
                                if (!this.hasSizedWindow) {
                                    const config = vscode.workspace.getConfiguration('ritalin.externalWindow');
                                    const userWidth = config.get<number>('width');
                                    const userHeight = config.get<number>('height');
                                    
                                    if (userWidth !== undefined && userHeight !== undefined) {
                                        this.outputChannel.appendLine(`[GameWindowManager] Setting user-configured startup size: ${userWidth}x${userHeight}`);
                                        this.setSize(userWidth, userHeight);
                                    } else {
                                        this.outputChannel.appendLine('[GameWindowManager] Setting reasonable startup size: 800x600 (will be overridden by game dimensions)');
                                        this.setSize(800, 600);
                                    }
                                }
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
                this.stopHeartbeat();
            });

            this.electronProcess.on('exit', (code) => {
                this.outputChannel.appendLine(`[GameWindowManager] Electron process exited with code: ${code}`);
                this.electronProcess = null;
                this.isReady = false;
                this.hasSizedWindow = false;
                this.currentlyLoadedGameId = null;
                this.stopHeartbeat();
            });

            // Add additional process monitoring for development
            if (process.env.NODE_ENV === 'development') {
                // Check process health every 3 seconds
                const healthCheckInterval = setInterval(() => {
                    if (this.electronProcess && !this.electronProcess.killed) {
                        // Process is still alive, continue monitoring
                        return;
                    } else {
                        // Process is dead, clean up
                        this.outputChannel.appendLine('[GameWindowManager] Health check: Electron process is dead, cleaning up...');
                        clearInterval(healthCheckInterval);
                        this.electronProcess = null;
                        this.isReady = false;
                        this.hasSizedWindow = false;
                        this.currentlyLoadedGameId = null;
                        this.stopHeartbeat();
                    }
                }, 3000);

                // Clean up interval when process exits
                this.electronProcess.on('exit', () => {
                    clearInterval(healthCheckInterval);
                });
            }
        } finally {
            this.isStarting = false;
        }
    }

    public stop(): void {
        this.stopHeartbeat();
        if (this.electronProcess) {
            this.outputChannel.appendLine('[GameWindowManager] Stopping Electron process...');
            
            // Try graceful shutdown first
            try {
                this.sendCommand({ command: 'quit' });
            } catch (error) {
                this.outputChannel.appendLine(`[GameWindowManager] Failed to send quit command: ${error}`);
            }
            
            // Give it a short moment, then terminate if it hasn't already
            setTimeout(() => {
                if (this.electronProcess && !this.electronProcess.killed) {
                    this.outputChannel.appendLine('[GameWindowManager] Force killing Electron process with SIGTERM...');
                    try {
                        this.electronProcess.kill('SIGTERM');
                    } catch (error) {
                        this.outputChannel.appendLine(`[GameWindowManager] SIGTERM failed: ${error}`);
                    }
                    
                    // If SIGTERM doesn't work, use SIGKILL after a shorter delay
                    setTimeout(() => {
                        if (this.electronProcess && !this.electronProcess.killed) {
                            this.outputChannel.appendLine('[GameWindowManager] Force killing with SIGKILL...');
                            try {
                                this.electronProcess.kill('SIGKILL');
                            } catch (error) {
                                this.outputChannel.appendLine(`[GameWindowManager] SIGKILL failed: ${error}`);
                            }
                        }
                        // Clean up reference regardless
                        this.electronProcess = null;
                        this.isReady = false;
                        this.hasSizedWindow = false;
                        this.currentlyLoadedGameId = null;
                    }, 1000); // Reduced from 2000ms to 1000ms
                }
            }, 500); // Reduced from 1000ms to 500ms
        }
    }

    public show(): void {
        this.outputChannel.appendLine('[GameWindowManager] Show command called');
        
        // If the process isn't running, start it first
        if (!this.electronProcess && !this.isStarting) {
            this.outputChannel.appendLine('[GameWindowManager] Electron process not running, starting it...');
            this.start().then(() => {
                this.sendCommand({ command: 'show' });
            }).catch(error => {
                this.outputChannel.appendLine(`[GameWindowManager] Failed to start Electron process: ${error}`);
            });
        } else {
            this.sendCommand({ command: 'show' });
        }
    }

    public hide(): void {
        this.outputChannel.appendLine('[GameWindowManager] Hide command called - hiding window (keeping process alive)');
        this.sendCommand({ command: 'hide' });
    }

    public restart(): void {
        this.outputChannel.appendLine('[GameWindowManager] Restart command called');
        this.stop();
        this.hasSizedWindow = false; // Reset sizing flag for restart
        // Start immediately without the previous delay
        this.start().catch(error => {
            this.outputChannel.appendLine(`[GameWindowManager] Failed to restart: ${error}`);
        });
    }

    public async preload(game: GameInfo | null): Promise<void> {
        this.outputChannel.appendLine('[GameWindowManager] Preloading game window...');
        // Start the process, which will remain hidden by default
        await this.start();
        if (game) {
            this.outputChannel.appendLine(`[GameWindowManager] Preloading content for game: ${game.title}`);
            // Pre-load the game content into the hidden window
            this.loadGame(game);
        }
    }

    public loadGame(game: GameInfo): void {
        // Use the game's entry point from the downloaded itch.io games
        const gamePath = game.entryPoint;
        this.outputChannel.appendLine(`[GameWindowManager] Loading game: ${game.title} from: ${gamePath}`);
        
        const config = vscode.workspace.getConfiguration('ritalin.externalWindow');
        const userWidth = config.get<number>('width');
        const userHeight = config.get<number>('height');
        const gameDimensions = this.getGameDimensions(game);
        
        // Determine dimensions priority: User config > Game defaults > System fallback
        let finalWidth: number;
        let finalHeight: number;
        
        if (userWidth && userHeight) {
            // User has explicitly configured dimensions - use them
            finalWidth = userWidth;
            finalHeight = userHeight;
            this.outputChannel.appendLine(`[GameWindowManager] Using user-configured dimensions: ${finalWidth}x${finalHeight}`);
        } else if (gameDimensions) {
            // No user config, but game has preferred dimensions - use game dimensions
            finalWidth = gameDimensions.width;
            finalHeight = gameDimensions.height;
            this.outputChannel.appendLine(`[GameWindowManager] Using game-specific dimensions: ${finalWidth}x${finalHeight}`);
        } else {
            // No user config and no game dimensions - use reasonable fallbacks
            finalWidth = 800;
            finalHeight = 600;
            this.outputChannel.appendLine(`[GameWindowManager] No specific dimensions found, using fallback: ${finalWidth}x${finalHeight}`);
        }
        
        // Apply the determined dimensions
        this.setSize(finalWidth, finalHeight);
        
        // Convert absolute path to file:// URL
        let gameUrl = gamePath;
        if (gamePath && !gamePath.startsWith('file://')) {
            gameUrl = 'file://' + gamePath;
        }
        
        this.outputChannel.appendLine(`[GameWindowManager] Game URL: ${gameUrl}`);
        
        // If the process isn't running, start it first
        if (!this.electronProcess && !this.isStarting) {
            this.outputChannel.appendLine('[GameWindowManager] Electron process not running, starting it for game load...');
            this.start().then(() => {
                this.sendCommand({ command: 'loadGame', gamePath: gameUrl });
            }).catch(error => {
                this.outputChannel.appendLine(`[GameWindowManager] Failed to start Electron process for game load: ${error}`);
            });
        } else {
            this.sendCommand({ command: 'loadGame', gamePath: gameUrl });
        }
        
        // Track the loaded game
        this.currentlyLoadedGameId = game.id;
    }

    public setPosition(x: number, y: number): void {
        this.sendCommand({ command: 'setPosition', x, y });
    }

    public setSize(width: number, height: number): void {
        this.sendCommand({ command: 'setSize', width, height });
        this.hasSizedWindow = true; // Mark that window has been explicitly sized
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

    public getLoadedGameId(): string | null {
        return this.currentlyLoadedGameId;
    }

    private sendCommand(message: any): void {
        if (!this.electronProcess || this.electronProcess.killed) {
            if (message.command !== 'ping') { // Don't log pings for cleaner logs
                this.outputChannel.appendLine(`[GameWindowManager] Cannot send command - Electron process not running or killed`);
            }
            return;
        }

        if (!this.isReady) {
            this.outputChannel.appendLine(`[GameWindowManager] Queueing message until Electron is ready: ${JSON.stringify(message)}`);
            this.messageQueue.push(message);
            return;
        }

        if (this.electronProcess.stdin && !this.electronProcess.stdin.destroyed) {
            const jsonMessage = JSON.stringify(message) + '\n';
            this.outputChannel.appendLine(`[GameWindowManager] Sending command to Electron: ${jsonMessage.trim()}`);
            try {
                this.electronProcess.stdin.write(jsonMessage);
            } catch (error) {
                this.outputChannel.appendLine(`[GameWindowManager] Failed to send command: ${error}`);
                // Process might be dead, mark as not ready
                this.isReady = false;
                this.electronProcess = null;
            }
        } else {
            this.outputChannel.appendLine('[GameWindowManager] Cannot send command - stdin not available or destroyed');
        }
    }

    private processMessageQueue(): void {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.sendCommand(message);
        }
    }

    public dispose(): void {
        this.outputChannel.appendLine('[GameWindowManager] Disposing...');
        this.stop();
        
        // Clear any queued messages
        this.messageQueue = [];
        this.isReady = false;
        this.hasSizedWindow = false;
        this.currentlyLoadedGameId = null;
        
        // Don't dispose output channel here - let extension handle it
    }

    private startHeartbeat(): void {
        this.stopHeartbeat(); // Ensure no multiple heartbeats
        
        // More frequent heartbeat during development to prevent zombie processes
        const heartbeatInterval = process.env.NODE_ENV === 'development' ? 2000 : 5000; // 2s in dev, 5s in prod
        
        this.heartbeatInterval = setInterval(() => {
            if (this.electronProcess && !this.electronProcess.killed) {
                this.sendCommand({ command: 'ping' });
            } else {
                // Process is dead, stop heartbeat and clean up
                this.outputChannel.appendLine('[GameWindowManager] Electron process is dead, stopping heartbeat');
                this.stopHeartbeat();
                this.electronProcess = null;
                this.isReady = false;
            }
        }, heartbeatInterval);
        
        this.outputChannel.appendLine(`[GameWindowManager] ❤️ Heartbeat started (${heartbeatInterval}ms interval).`);
    }

    private stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
            this.outputChannel.appendLine('[GameWindowManager] 💔 Heartbeat stopped.');
        }
    }
} 