import * as vscode from 'vscode';

export class CursorDetector {
    private _onAiGenerationStart = new vscode.EventEmitter<void>();
    private _onAiGenerationEnd = new vscode.EventEmitter<void>();
    private _disposables: vscode.Disposable[] = [];
    private _isGenerating = false;
    private _commandWrappers: Map<string, vscode.Disposable> = new Map();
    private _generationTimeout: NodeJS.Timeout | null = null;
    private _statusBarCheckInterval: NodeJS.Timeout | null = null;

    public readonly onAiGenerationStart = this._onAiGenerationStart.event;
    public readonly onAiGenerationEnd = this._onAiGenerationEnd.event;

    constructor() {
        this._setupDetection();
    }

    private _setupDetection(): void {
        // Method 1: Monitor status bar for "Generating..." text
        // TEMPORARILY DISABLED - causing false positives
        // this._monitorStatusBar();
        
        // Method 2: Intercept Cursor-specific commands
        this._interceptCursorCommands();
        
        // Method 3: Monitor active text editor changes
        this._monitorEditorChanges();
        
        // Method 4: Monitor workspace state (for detecting chat panel activity)
        this._monitorWorkspaceState();
    }

    private _monitorStatusBar(): void {
        // TEMPORARILY DISABLED - this method was causing repeated triggers
        // The checks were too broad and detecting false positives
        return;
        
        // Check status bar items periodically
        this._statusBarCheckInterval = setInterval(() => {
            try {
                // VS Code doesn't expose a direct API to read all status bar items
                // But we can check for visible changes in the UI through other means
                
                // Check if any visible text contains "Generating"
                // This is a workaround - in practice, we might need to use other indicators
                const activeEditor = vscode.window.activeTextEditor;
                if (activeEditor) {
                    // Check if there are any decorations or diagnostics that might indicate generation
                    const diagnostics = vscode.languages.getDiagnostics(activeEditor.document.uri);
                    
                    // Look for specific patterns in diagnostics that might indicate AI activity
                    const hasAiDiagnostics = diagnostics.some(diag => 
                        diag.source?.toLowerCase().includes('cursor') ||
                        diag.message.toLowerCase().includes('generating')
                    );
                    
                    if (hasAiDiagnostics && !this._isGenerating) {
                        console.log('[CursorDetector] Detected AI-related diagnostics');
                        this._startGeneration();
                    }
                }
                
                // Additional check: monitor for specific window state changes
                // that might indicate AI generation
                const visibleEditors = vscode.window.visibleTextEditors;
                const hasChatPanel = visibleEditors.some(editor => 
                    editor.document.uri.scheme === 'output' && 
                    editor.document.uri.path.includes('chat')
                );
                
                if (hasChatPanel && !this._isGenerating) {
                    console.log('[CursorDetector] Detected chat panel activity');
                    this._startGeneration();
                }
                
            } catch (error) {
                console.error('[CursorDetector] Error monitoring status bar:', error);
            }
        }, 250); // Check every 250ms
    }

    private _interceptCursorCommands(): void {
        // List of known Cursor AI commands
        const cursorCommands = [
            'cursor.action.generateCode',
            'cursor.action.chat',
            'cursor.inline.completion.trigger',
            'workbench.action.chat.open',
            'cursor.action.acceptCompletion',
            'cursor.action.rejectCompletion'
        ];

        cursorCommands.forEach(commandId => {
            // Try to wrap the command
            try {
                const wrapper = vscode.commands.registerCommand(`${commandId}.wrapped`, async (...args: any[]) => {
                    console.log(`[CursorDetector] Command intercepted: ${commandId}`);
                    
                    // Fire generation start event
                    this._startGeneration();
                    
                    // Execute the original command
                    try {
                        return await vscode.commands.executeCommand(commandId, ...args);
                    } catch (error) {
                        console.error(`[CursorDetector] Error executing command ${commandId}:`, error);
                        throw error;
                    }
                });
                
                this._commandWrappers.set(commandId, wrapper);
                this._disposables.push(wrapper);
            } catch (error) {
                console.log(`[CursorDetector] Could not wrap command ${commandId}:`, error);
            }
        });
    }

    private _monitorEditorChanges(): void {
        // Monitor for rapid, large text changes that might indicate AI generation
        let lastChangeTime = 0;
        let changeCount = 0;
        
        const changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
            // Skip if already generating to avoid repeated triggers
            if (this._isGenerating) {
                return;
            }
            
            const now = Date.now();
            const timeSinceLastChange = now - lastChangeTime;
            
            // Reset counter if too much time has passed
            if (timeSinceLastChange > 1000) {
                changeCount = 0;
            }
            
            // Check for AI-like changes
            const isLargeChange = event.contentChanges.some(change => change.text.length > 50);
            const isRapidChange = timeSinceLastChange < 100;
            
            if (isLargeChange || (isRapidChange && ++changeCount > 3)) {
                console.log('[CursorDetector] Detected rapid/large text changes - possible AI generation');
                this._startGeneration();
            }
            
            lastChangeTime = now;
        });
        
        this._disposables.push(changeListener);
    }

    private _monitorWorkspaceState(): void {
        // Monitor for changes in workspace state that might indicate AI activity
        const stateListener = vscode.workspace.onDidChangeConfiguration((event) => {
            // Check if any AI-related settings changed
            if (event.affectsConfiguration('cursor') || event.affectsConfiguration('ai')) {
                console.log('[CursorDetector] AI-related configuration changed');
            }
        });
        
        this._disposables.push(stateListener);
        
        // Also monitor active panel changes
        const panelListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
            // If switching away from editor, might indicate AI completion
            if (!editor && this._isGenerating) {
                this._endGeneration();
            }
        });
        
        this._disposables.push(panelListener);
    }

    private _startGeneration(): void {
        if (!this._isGenerating) {
            this._isGenerating = true;
            this._onAiGenerationStart.fire();
            console.log('[CursorDetector] AI generation started');
            this._setGenerationTimeout();
        } else {
            // Generation already in progress, just reset the timeout
            console.log('[CursorDetector] AI generation already in progress, resetting timeout');
            this._setGenerationTimeout();
        }
    }

    private _setGenerationTimeout(): void {
        // Clear existing timeout
        if (this._generationTimeout) {
            clearTimeout(this._generationTimeout);
        }
        
        // Set new timeout - assume generation ends after 5 seconds of no activity
        this._generationTimeout = setTimeout(() => {
            if (this._isGenerating) {
                console.log('[CursorDetector] Generation timeout reached - ending generation');
                this._endGeneration();
            }
        }, 5000);
    }

    private _endGeneration(): void {
        if (this._isGenerating) {
            this._isGenerating = false;
            this._onAiGenerationEnd.fire();
            console.log('[CursorDetector] AI generation ended');
            
            if (this._generationTimeout) {
                clearTimeout(this._generationTimeout);
                this._generationTimeout = null;
            }
        }
    }

    public dispose(): void {
        this._endGeneration();
        
        // Clear intervals
        if (this._statusBarCheckInterval) {
            clearInterval(this._statusBarCheckInterval);
            this._statusBarCheckInterval = null;
        }
        
        // Dispose command wrappers
        this._commandWrappers.forEach((disposable) => {
            disposable.dispose();
        });
        this._commandWrappers.clear();
        
        // Dispose other resources
        this._onAiGenerationStart.dispose();
        this._onAiGenerationEnd.dispose();
        
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    // Test methods for manual triggering during development
    public triggerAiStart(): void {
        this._startGeneration();
    }

    public triggerAiEnd(): void {
        this._endGeneration();
    }
} 