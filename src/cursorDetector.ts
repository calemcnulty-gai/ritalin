import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Simplified CursorDetector that only watches the .cursor/is_working file
 * to detect when AI is generating code.
 */
export class CursorDetector {
    private _onAiGenerationStart = new vscode.EventEmitter<void>();
    public readonly onAiGenerationStart = this._onAiGenerationStart.event;

    private _onAiGenerationEnd = new vscode.EventEmitter<void>();
    public readonly onAiGenerationEnd = this._onAiGenerationEnd.event;

    private disposables: vscode.Disposable[] = [];
    private _isGenerating = false;
    private outputChannel: vscode.OutputChannel;
    private fileWatcher: vscode.FileSystemWatcher | null = null;
    private selfReportTimeout: NodeJS.Timeout | null = null;
    private readonly SELF_REPORT_TIMEOUT_MS = 60000; // 60 seconds

    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
        this.outputChannel.appendLine('[CursorDetector] AI Detection System Starting...');
        this.setupFileWatcher();
        this.outputChannel.appendLine('[CursorDetector] AI Detection System Ready');
    }

    private setupFileWatcher(): void {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            this.outputChannel.appendLine('[CursorDetector] No workspace folder found');
            return;
        }

        const isWorkingPath = path.join(workspaceFolder.uri.fsPath, '.cursor', 'is_working');
        const isWorkingUri = vscode.Uri.file(isWorkingPath);

        // Ensure the file exists
        this.ensureIsWorkingFileExists(isWorkingUri);

        // Watch for changes to the is_working file
        const pattern = new vscode.RelativePattern(workspaceFolder, '.cursor/is_working');
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern, false, false, false);

        this.fileWatcher.onDidChange((uri) => {
            this.handleIsWorkingFileChange(uri);
        });

        this.fileWatcher.onDidCreate((uri) => {
            this.handleIsWorkingFileChange(uri);
        });

        this.disposables.push(this.fileWatcher);

        // Read initial state
        this.readIsWorkingFile(isWorkingUri);
    }

    private async ensureIsWorkingFileExists(uri: vscode.Uri): Promise<void> {
        try {
            await vscode.workspace.fs.stat(uri);
        } catch (error) {
            // File doesn't exist, create it with initial value
            try {
                await vscode.workspace.fs.writeFile(uri, Buffer.from('false', 'utf8'));
                this.outputChannel.appendLine('[CursorDetector] Created .cursor/is_working file');
            } catch (writeError) {
                this.outputChannel.appendLine(`[CursorDetector] Failed to create is_working file: ${writeError}`);
            }
        }
    }

    private async handleIsWorkingFileChange(uri: vscode.Uri): Promise<void> {
        await this.readIsWorkingFile(uri);
    }

    private async readIsWorkingFile(uri: vscode.Uri): Promise<void> {
        try {
            const content = await vscode.workspace.fs.readFile(uri);
            const isWorking = content.toString().trim() === 'true';

            if (isWorking && !this._isGenerating) {
                this.outputChannel.appendLine('[CursorDetector] AI Status: ⚡ Working');
                this.startGeneration();
                this.startSelfReportTimeout();
            } else if (!isWorking && this._isGenerating) {
                this.outputChannel.appendLine('[CursorDetector] AI Status: 💤 Idle');
                this.endGeneration();
                this.clearSelfReportTimeout();
            }
        } catch (error) {
            this.outputChannel.appendLine(`[CursorDetector] Error reading is_working file: ${error}`);
        }
    }

    private startGeneration(): void {
        this._isGenerating = true;
        this.outputChannel.appendLine('[CursorDetector] 🎮 AI Working - Game Shown');
        this._onAiGenerationStart.fire();
    }

    private endGeneration(): void {
        if (this._isGenerating) {
            this._isGenerating = false;
            this.outputChannel.appendLine('[CursorDetector] ⏸️  AI Idle - Game Hidden');
            this._onAiGenerationEnd.fire();
        }
    }

    private startSelfReportTimeout(): void {
        this.clearSelfReportTimeout();
        this.selfReportTimeout = setTimeout(() => {
            this.outputChannel.appendLine('[CursorDetector] ⏰ Self-report timeout reached (60s) - assuming AI is idle');
            this.endGeneration();
        }, this.SELF_REPORT_TIMEOUT_MS);
    }

    private clearSelfReportTimeout(): void {
        if (this.selfReportTimeout) {
            clearTimeout(this.selfReportTimeout);
            this.selfReportTimeout = null;
        }
    }

    public dispose(): void {
        this.clearSelfReportTimeout();
        this.disposables.forEach(d => d.dispose());
    }

    public get isGenerating(): boolean {
        return this._isGenerating;
    }
} 