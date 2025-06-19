import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { GameInfo } from './types';

const execAsync = promisify(exec);

export class GameManager {
    private _context: vscode.ExtensionContext;
    private _gamesStoragePath: string;
    private _downloadedGames: Map<string, GameInfo> = new Map();
    private _outputChannel: vscode.OutputChannel;

    constructor(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
        this._context = context;
        this._outputChannel = outputChannel;
        this._gamesStoragePath = path.join(context.globalStorageUri.fsPath, 'games');
        
        // Ensure games directory exists
        if (!fs.existsSync(this._gamesStoragePath)) {
            fs.mkdirSync(this._gamesStoragePath, { recursive: true });
        }
        
        this._loadDownloadedGames();
    }

    public async initialize(): Promise<void> {
        // Initialization logic can be added here if needed in the future
    }

    private _loadDownloadedGames(): void {
        try {
            const gamesJsonPath = path.join(this._gamesStoragePath, 'games.json');
            if (fs.existsSync(gamesJsonPath)) {
                const gamesData = JSON.parse(fs.readFileSync(gamesJsonPath, 'utf8'));
                this._downloadedGames = new Map(Object.entries(gamesData));
                this._outputChannel.appendLine(`[GameManager] Loaded ${this._downloadedGames.size} downloaded games`);
            }
        } catch (error) {
            this._outputChannel.appendLine(`[GameManager] Failed to load downloaded games: ${error}`);
        }
    }

    private _saveDownloadedGames(): void {
        try {
            const gamesJsonPath = path.join(this._gamesStoragePath, 'games.json');
            const gamesData = Object.fromEntries(this._downloadedGames);
            fs.writeFileSync(gamesJsonPath, JSON.stringify(gamesData, null, 2));
        } catch (error) {
            this._outputChannel.appendLine(`[GameManager] Failed to save downloaded games: ${error}`);
        }
    }
    
    private runPythonScript(scriptName: string, args: string[]): Promise<any> {
        return new Promise((resolve, reject) => {
            const scriptPath = path.join(this._context.extensionPath, 'scripts', scriptName);
            const pythonProcess = spawn('python3', [scriptPath, ...args]);

            let stdout = '';
            let stderr = '';

            pythonProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    return reject(new Error(`Python script exited with code ${code}: ${stderr}`));
                }
                try {
                    const result = JSON.parse(stdout);
                    resolve(result);
                } catch (error) {
                    reject(new Error(`Failed to parse Python script output: ${stdout}, stderr: ${stderr}`));
                }
            });
        });
    }

    private runDownloadScript(gameUrl: string, gameId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const scriptPath = path.join(this._context.extensionPath, 'scripts', 'grab_itch_game.py');
            const pythonProcess = spawn('python3', [scriptPath, gameUrl, gameId]);

            let stdout = '';
            let stderr = '';

            pythonProcess.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;
                // Log output to output channel (strip ANSI codes for cleaner logs)
                const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, '');
                this._outputChannel.append(cleanOutput);
            });

            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    return reject(new Error(`Download script exited with code ${code}: ${stderr}`));
                }
                // For the download script, success is determined by exit code, not JSON output
                // Check if the output contains success message
                if (stdout.includes('SUCCESS') && stdout.includes('Game successfully downloaded')) {
                    resolve();
                } else {
                    reject(new Error(`Download may have failed. Output: ${stdout}`));
                }
            });
        });
    }

    public async searchItchGames(query: string): Promise<GameInfo[]> {
        const result = await this.runPythonScript('search_games.py', [query]);
        return result.games.map((game: GameInfo) => ({
            ...game,
            isDownloaded: this._downloadedGames.has(game.id),
        }));
    }

    public async getPopularGames(): Promise<GameInfo[]> {
        this._outputChannel.appendLine('[GameManager] getPopularGames() called');
        try {
            this._outputChannel.appendLine('[GameManager] Running Python script search_games.py with no args...');
            const result = await this.runPythonScript('search_games.py', []);
            this._outputChannel.appendLine(`[GameManager] Python script returned: ${JSON.stringify(result, null, 2)}`);
            this._outputChannel.appendLine(`[GameManager] Games found: ${result.games?.length || 0}`);
            
            const games = result.games.map((game: GameInfo) => ({
                ...game,
                isDownloaded: this._downloadedGames.has(game.id),
            }));
            this._outputChannel.appendLine(`[GameManager] Processed games: ${games.map((g: GameInfo) => g.title).join(', ')}`);
            return games;
        } catch (error) {
            this._outputChannel.appendLine(`[GameManager] Error in getPopularGames: ${error}`);
            throw error;
        }
    }

    public async downloadGame(gameInfo: GameInfo): Promise<GameInfo> {
        const gameId = gameInfo.id || this._generateGameId(gameInfo.url);
        const gamePath = path.join(this._gamesStoragePath, gameId);
        
        try {
            this._outputChannel.appendLine(`[GameManager] Downloading game: ${gameInfo.title} from ${gameInfo.url}`);
            
            // Use the Python script to download and extract the game
            await this.runDownloadScript(gameInfo.url, gameId);
            
            // Find the entry point (standalone.html or index.html)  
            const entryPoint = this._findGameEntryPoint(gamePath);
            
            const downloadedGame: GameInfo = {
                ...gameInfo,
                id: gameId,
                isDownloaded: true,
                downloadPath: gamePath,
                entryPoint: entryPoint
            };
            
            this._downloadedGames.set(gameId, downloadedGame);
            this._saveDownloadedGames();
            
            this._outputChannel.appendLine(`[GameManager] Game downloaded successfully: ${gameInfo.title}`);
            return downloadedGame;
        } catch (error) {
            this._outputChannel.appendLine(`[GameManager] Game download failed: ${error}`);
            throw new Error(`Failed to download game: ${error}`);
        }
    }

    public getDownloadedGames(): GameInfo[] {
        return Array.from(this._downloadedGames.values());
    }

    public getSelectedGame(): GameInfo | undefined {
        const config = vscode.workspace.getConfiguration('ritalin');
        const selectedGameId = config.get<string>('selectedGame');
        
        if (selectedGameId && this._downloadedGames.has(selectedGameId)) {
            return this._downloadedGames.get(selectedGameId);
        }
        
        return undefined;
    }

    public async setSelectedGame(gameId: string | null): Promise<void> {
        if (gameId === null || this._downloadedGames.has(gameId)) {
            const config = vscode.workspace.getConfiguration('ritalin');
            await config.update('selectedGame', gameId, vscode.ConfigurationTarget.Global);
        } else {
            throw new Error('Game not found in downloaded games');
        }
    }

    public async deleteGame(gameId: string): Promise<void> {
        const game = this._downloadedGames.get(gameId);
        if (game && game.downloadPath) {
            try {
                // Remove directory
                fs.rmSync(game.downloadPath, { recursive: true, force: true });
                
                // Remove from map and save
                this._downloadedGames.delete(gameId);
                this._saveDownloadedGames();
                
                // If this was the selected game, clear selection
                const config = vscode.workspace.getConfiguration('ritalin');
                const selectedGameId = config.get<string>('selectedGame');
                if (selectedGameId === gameId) {
                    await config.update('selectedGame', null, vscode.ConfigurationTarget.Global);
                }
            } catch (error) {
                this._outputChannel.appendLine(`[GameManager] Failed to delete game: ${error}`);
                throw new Error(`Failed to delete game: ${error}`);
            }
        }
    }

    private _generateGameId(url: string): string {
        // Extract game identifier from itch.io URL
        const match = url.match(/https:\/\/(.+)\.itch\.io\/(.+)/);
        if (match) {
            return `${match[1]}-${match[2]}`;
        }
        // Fallback to URL hash
        return Buffer.from(url).toString('base64').slice(0, 16);
    }

    private _findGameEntryPoint(gamePath: string): string | undefined {
        const possibleEntryPoints = ['standalone.html', 'index.html', 'game.html'];
        
        for (const entryPoint of possibleEntryPoints) {
            const fullPath = path.join(gamePath, entryPoint);
            if (fs.existsSync(fullPath)) {
                return fullPath;
            }
        }
        
        return undefined;
    }
} 