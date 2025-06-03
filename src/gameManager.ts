import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface GameInfo {
    id: string;
    title: string;
    author: string;
    url: string;
    description?: string;
    tags?: string[];
    thumbnailUrl?: string;
    isDownloaded: boolean;
    downloadPath?: string;
    entryPoint?: string; // Path to standalone.html or index.html
    rating?: string;
    isDefault?: boolean;
}

interface CuratedGamesData {
    default_game: string;
    games: any[];
}

export class GameManager {
    private _context: vscode.ExtensionContext;
    private _gamesStoragePath: string;
    private _downloadedGames: Map<string, GameInfo> = new Map();
    private _curatedGames: CuratedGamesData | null = null;

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
        this._gamesStoragePath = path.join(context.globalStorageUri.fsPath, 'games');
        
        // Ensure games directory exists
        if (!fs.existsSync(this._gamesStoragePath)) {
            fs.mkdirSync(this._gamesStoragePath, { recursive: true });
        }
        
        this._loadDownloadedGames();
        this._loadCuratedGames();
    }

    public async initialize(): Promise<void> {
        // Auto-download default game if no games are downloaded yet
        const hasDownloadedGames = this._downloadedGames.size > 0;
        const hasSelectedGame = vscode.workspace.getConfiguration('ritalin').get<string>('selectedGame');
        
        if (!hasDownloadedGames || !hasSelectedGame) {
            console.log('[Ritalin] No games found, downloading default game...');
            await this._downloadDefaultGame();
        }
    }

    private _loadCuratedGames(): void {
        try {
            const curatedGamesPath = path.join(this._context.extensionPath, 'scripts', 'curated_games.json');
            if (fs.existsSync(curatedGamesPath)) {
                const content = fs.readFileSync(curatedGamesPath, 'utf8');
                this._curatedGames = JSON.parse(content);
                console.log('[Ritalin] Loaded', this._curatedGames?.games.length || 0, 'curated games');
            }
        } catch (error) {
            console.error('[Ritalin] Failed to load curated games:', error);
        }
    }

    private _loadDownloadedGames(): void {
        try {
            const gamesJsonPath = path.join(this._gamesStoragePath, 'games.json');
            if (fs.existsSync(gamesJsonPath)) {
                const gamesData = JSON.parse(fs.readFileSync(gamesJsonPath, 'utf8'));
                this._downloadedGames = new Map(Object.entries(gamesData));
                console.log('[Ritalin] Loaded', this._downloadedGames.size, 'downloaded games');
            }
        } catch (error) {
            console.error('[Ritalin] Failed to load downloaded games:', error);
        }
    }

    private _saveDownloadedGames(): void {
        try {
            const gamesJsonPath = path.join(this._gamesStoragePath, 'games.json');
            const gamesData = Object.fromEntries(this._downloadedGames);
            fs.writeFileSync(gamesJsonPath, JSON.stringify(gamesData, null, 2));
        } catch (error) {
            console.error('[Ritalin] Failed to save downloaded games:', error);
        }
    }

    public getCuratedGames(filter?: string): GameInfo[] {
        if (!this._curatedGames) {
            return [];
        }

        try {
            const scriptPath = path.join(this._context.extensionPath, 'scripts', 'search_games.py');
            const command = filter ? `python3 "${scriptPath}" "${filter}"` : `python3 "${scriptPath}"`;
            
            // For now, return synchronously from loaded data. TODO: Make async
            let games = this._curatedGames.games;
            
            if (filter) {
                const filterLower = filter.toLowerCase();
                games = games.filter(game => {
                    const searchText = [
                        game.title || '',
                        game.author || '',
                        game.description || '',
                        ...(game.tags || [])
                    ].join(' ').toLowerCase();
                    return searchText.includes(filterLower);
                });
            }

            return games.map((game: any) => ({
                id: game.id,
                title: game.title,
                author: game.author,
                url: game.url,
                description: game.description,
                tags: game.tags,
                thumbnailUrl: game.thumbnail,
                rating: game.rating,
                isDefault: game.default || false,
                isDownloaded: this._downloadedGames.has(game.id),
                downloadPath: undefined,
                entryPoint: undefined
            }));
        } catch (error) {
            console.error('[Ritalin] Failed to get curated games:', error);
            return [];
        }
    }

    // Keep the old search method for backward compatibility, but use curated games
    public async searchItchGames(query: string): Promise<GameInfo[]> {
        return this.getCuratedGames(query);
    }

    private async _downloadDefaultGame(): Promise<void> {
        if (!this._curatedGames) {
            console.log('[Ritalin] No curated games available');
            return;
        }

        const defaultGameId = this._curatedGames.default_game;
        const defaultGame = this._curatedGames.games.find(g => g.id === defaultGameId);
        
        if (!defaultGame) {
            console.log('[Ritalin] Default game not found in curated list');
            return;
        }

        try {
            const gameInfo: GameInfo = {
                id: defaultGame.id,
                title: defaultGame.title,
                author: defaultGame.author,
                url: defaultGame.url,
                description: defaultGame.description,
                tags: defaultGame.tags,
                thumbnailUrl: defaultGame.thumbnail,
                rating: defaultGame.rating,
                isDefault: true,
                isDownloaded: false
            };

            console.log(`[Ritalin] Downloading default game: ${gameInfo.title}`);
            const downloadedGame = await this.downloadGame(gameInfo);
            
            // Set as selected game
            await this.setSelectedGame(downloadedGame.id);
            console.log(`[Ritalin] Default game "${gameInfo.title}" downloaded and selected`);
        } catch (error) {
            console.error('[Ritalin] Failed to download default game:', error);
        }
    }

    public async downloadGame(gameInfo: GameInfo): Promise<GameInfo> {
        const gameId = gameInfo.id;
        const gamePath = path.join(this._gamesStoragePath, gameId);
        
        try {
            console.log(`[Ritalin] Downloading game: ${gameInfo.title} from ${gameInfo.url}`);
            
            // Use the Python script to download and extract the game
            const scriptPath = path.join(this._context.extensionPath, 'scripts', 'download_game.py');
            await execAsync(`python3 "${scriptPath}" "${gameInfo.url}" "${gamePath}"`);
            
            // Find the entry point (standalone.html or index.html)
            const entryPoint = this._findGameEntryPoint(gamePath);
            
            const downloadedGame: GameInfo = {
                ...gameInfo,
                isDownloaded: true,
                downloadPath: gamePath,
                entryPoint: entryPoint
            };
            
            this._downloadedGames.set(gameId, downloadedGame);
            this._saveDownloadedGames();
            
            console.log(`[Ritalin] Game downloaded successfully: ${gameInfo.title}`);
            return downloadedGame;
        } catch (error) {
            console.error('[Ritalin] Game download failed:', error);
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

    public async setSelectedGame(gameId: string): Promise<void> {
        if (this._downloadedGames.has(gameId)) {
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
                    await config.update('selectedGame', '', vscode.ConfigurationTarget.Global);
                }
            } catch (error) {
                console.error('[Ritalin] Failed to delete game:', error);
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