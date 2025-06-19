import * as vscode from 'vscode';
// StatusBarManager removed - using game window show/hide as primary indicator
import { debounce } from 'lodash';

interface DetectionEvent {
    method: string;
    timestamp: number;
    confidence: number;
    data: any;
    source: string;
}

interface DetectionMethod {
    name: string;
    tier: number;
    isActive(): boolean;
    getConfidence(): number;
    getLastDetection(): Date | null;
    start(): void;
    stop(): void;
    onDetection(callback: (event: DetectionEvent) => void): void;
}

export class CursorDetector {
    private _onAiGenerationStart = new vscode.EventEmitter<void>();
    public readonly onAiGenerationStart = this._onAiGenerationStart.event;

    private _onAiGenerationEnd = new vscode.EventEmitter<void>();
    public readonly onAiGenerationEnd = this._onAiGenerationEnd.event;

    private disposables: vscode.Disposable[] = [];
    private _isGenerating = false;
    private outputChannel: vscode.OutputChannel;
    private debouncedEndGeneration: () => void;
    private detectionMethods: Map<string, DetectionMethod> = new Map();
    private detectionEvents: DetectionEvent[] = [];
    private lastDetectionTime: number = 0;
    private readonly DETECTION_THRESHOLD = 0.5; // 50% confidence required (lowered for testing)
    private readonly DETECTION_TIMEOUT = 5000; // 5 seconds timeout
    private readonly STARTUP_SUPPRESSION_TIME = 10000; // 10 seconds after startup to ignore other methods
    private startupTime: number = Date.now();
    private lastSelfReportState: boolean = false; // Track the last known AI state
    private stats = {
        totalDetections: 0,
        falsePositives: 0,
        lastReset: Date.now()
    };

    private methodStatus: Record<string, {
        lastDetection: number | null;
        confidence: number;
        firing: boolean;
        lastEvent: DetectionEvent | null;
        error: string | null;
    }> = {};

    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
        console.log('[CursorDetector] Constructor called');
        
        // Add back minimal essential logging
        this.outputChannel.appendLine('[CursorDetector] AI Detection System Starting...');

        // Debounce the end generation function to only fire after 500ms of inactivity
        this.debouncedEndGeneration = debounce(() => {
            this.endGeneration();
        }, 500);

        this.initializeDetectionMethods();
        this.setupEventListeners();
        
        // Add completion message
        this.outputChannel.appendLine('[CursorDetector] AI Detection System Ready');
        
        // Disable periodic logging to reduce output clutter
        // setInterval(() => {
        //     this.logDetectorStatus();
        // }, 120000); // Every 2 minutes - DISABLED
    }

    private initializeDetectionMethods(): void {
        // Only active, working detection methods

        // Document Change Analysis
        this.detectionMethods.set('document', {
            name: 'Document Change Analysis',
            tier: 2,
            isActive: () => true,
            getConfidence: () => this.methodStatus['document']?.confidence ?? 0,
            getLastDetection: () => this.methodStatus['document']?.lastDetection ? new Date(this.methodStatus['document'].lastDetection!) : null,
            start: () => {},
            stop: () => {},
            onDetection: () => {}
        });
        this.methodStatus['document'] = { lastDetection: null, confidence: 0, firing: false, lastEvent: null, error: null };

        // NEW: Selection Change Monitoring
        this.detectionMethods.set('selection', {
            name: 'Selection Change Monitoring',
            tier: 2,
            isActive: () => true,
            getConfidence: () => this.methodStatus['selection']?.confidence ?? 0,
            getLastDetection: () => this.methodStatus['selection']?.lastDetection ? new Date(this.methodStatus['selection'].lastDetection!) : null,
            start: () => this.setupSelectionMonitoring(),
            stop: () => this.cleanupSelectionMonitoring(),
            onDetection: (callback) => this.onSelectionChange(callback)
        });
        this.methodStatus['selection'] = { lastDetection: null, confidence: 0, firing: false, lastEvent: null, error: null };

        // NEW: Chat/Focus Change Detection
        this.detectionMethods.set('chat', {
            name: 'Chat/Focus Change Detection',
            tier: 2,
            isActive: () => true,
            getConfidence: () => this.methodStatus['chat']?.confidence ?? 0,
            getLastDetection: () => this.methodStatus['chat']?.lastDetection ? new Date(this.methodStatus['chat'].lastDetection!) : null,
            start: () => this.setupChatDetection(),
            stop: () => this.cleanupChatDetection(),
            onDetection: (callback) => this.onChatActivity(callback)
        });
        this.methodStatus['chat'] = { lastDetection: null, confidence: 0, firing: false, lastEvent: null, error: null };

        // NEW: AI Self-Reporting via File Watching
        this.detectionMethods.set('selfReport', {
            name: 'AI Self-Reporting (is_working)',
            tier: 1, // Tier 1 - this is the most reliable method
            isActive: () => true,
            getConfidence: () => this.methodStatus['selfReport']?.confidence ?? 0,
            getLastDetection: () => this.methodStatus['selfReport']?.lastDetection ? new Date(this.methodStatus['selfReport'].lastDetection!) : null,
            start: () => this.setupSelfReportDetection(),
            stop: () => this.cleanupSelfReportDetection(),
            onDetection: (callback) => this.onSelfReportChange(callback)
        });
        this.methodStatus['selfReport'] = { lastDetection: null, confidence: 0, firing: false, lastEvent: null, error: null };

        // End of active detection methods
    }

    private setupEventListeners(): void {
        this.disposables.push(
            this._onAiGenerationStart,
            this._onAiGenerationEnd,
            this.outputChannel,
            vscode.workspace.onDidChangeTextDocument(this.handleTextDocumentChange, this)
        );

        // Start all detection methods
        this.detectionMethods.forEach(method => {
            method.start();
            method.onDetection(this.handleDetectionEvent.bind(this));
        });
    }

    // Disabled detection methods removed for cleaner codebase

    private handleDetectionEvent(event: DetectionEvent): void {
        // Log essential state changes only
        if (event.method === 'selfReport') {
            // Simple state notification
            this.outputChannel.appendLine(`[CursorDetector] AI Status: ${event.data.isWorking ? '⚡ Working' : '💤 Idle'}`);
        }
        
        this.detectionEvents.push(event);
        this.lastDetectionTime = event.timestamp;
        this.stats.totalDetections++;
        
        // Track per-method status
        if (this.methodStatus[event.method]) {
            this.methodStatus[event.method].lastDetection = event.timestamp;
            this.methodStatus[event.method].confidence = event.confidence;
            this.methodStatus[event.method].firing = true;
            this.methodStatus[event.method].lastEvent = event;
            this.methodStatus[event.method].error = null;
        }
        
        // Reset firing state for other methods
        Object.keys(this.methodStatus).forEach(key => {
            if (key !== event.method) {
                this.methodStatus[key].firing = false;
            }
        });

        // Calculate aggregate confidence
        const confidence = this.calculateAggregateConfidence();
        
        if (confidence >= this.DETECTION_THRESHOLD && !this._isGenerating) {
            this.outputChannel.appendLine('[CursorDetector] 🚀 Showing Game');
            this.startGeneration();
        } else if (confidence < this.DETECTION_THRESHOLD && this._isGenerating) {
            this.outputChannel.appendLine('[CursorDetector] 🛑 Hiding Game');
            this.debouncedEndGeneration();
        }
    }

    private calculateAggregateConfidence(): number {
        if (this.detectionEvents.length === 0) return 0;

        const recentEvents = this.detectionEvents.filter(
            event => Date.now() - event.timestamp < this.DETECTION_TIMEOUT
        );

        if (recentEvents.length === 0) {
            // If no recent events but we have a known self-report state of "not working", enforce it
            if (this.lastSelfReportState === false) {
                // Remove verbose logging - AI said not working
                return 0.01; // INVIOLABLE: AI said it's not working
            }
            return 0;
        }

        // Check if we have a recent self-report event - this should be authoritative
        const recentSelfReport = recentEvents.find(event => event.method === 'selfReport');
        if (recentSelfReport) {
            // Store the last known state from self-report
            this.lastSelfReportState = recentSelfReport.data.isWorking;
            
            // INVIOLABLE RULE: If AI explicitly says it's not working, override ANY other detection
            if (!recentSelfReport.data.isWorking) {
                // Remove verbose logging - AI says idle
                return 0.01; // Very low confidence when AI says it's idle - this CANNOT be overridden
            }
            
            // If AI says it's working, use high confidence
            return recentSelfReport.confidence;
        }

        // INVIOLABLE RULE: Even without recent self-report, if last known state was "not working", enforce it
        if (this.lastSelfReportState === false) {
            // Remove verbose logging - respecting last known idle state
            return 0.01; // AI previously said it's not working - respect that until told otherwise
        }

        // During startup suppression time, ignore other methods unless we have self-report
        const timeSinceStartup = Date.now() - this.startupTime;
        if (timeSinceStartup < this.STARTUP_SUPPRESSION_TIME) {
            // Use last known self-report state if available
            if (this.lastSelfReportState) {
                return 0.8; // High confidence if AI was working
            } else {
                return 0.01; // Low confidence if AI was idle or unknown
            }
        }

        // Normal aggregation for other methods when startup suppression is over
        // BUT only if we don't have a negative self-report state
        const totalConfidence = recentEvents.reduce(
            (sum, event) => sum + event.confidence,
            0
        );

        return totalConfidence / recentEvents.length;
    }

    // Cleanup methods for disabled detection removed

    private handleTextDocumentChange(event: vscode.TextDocumentChangeEvent): void {
        if (event.document.uri.scheme !== 'file') {
            return;
        }

        if (event.contentChanges.length === 0) {
            return;
        }

        // Analyze the changes for AI patterns (removed verbose logging)
        let totalChanges = 0;
        let largeChanges = 0;
        let rapidChanges = 0;
        
        for (const change of event.contentChanges) {
            totalChanges += change.text.length;
            if (change.text.length > 50) {
                largeChanges++;
            }
            if (change.text.length > 200) {
                rapidChanges++;
            }
        }

        // Calculate confidence based on change patterns
        let confidence = 0.3; // Base confidence for any change
        
        if (largeChanges > 0) {
            confidence += 0.3; // Large changes are more likely AI
        }
        
        if (rapidChanges > 0) {
            confidence += 0.4; // Very large changes are very likely AI
        }
        
        if (totalChanges > 500) {
            confidence += 0.3; // Very large total change
        }

        confidence = Math.min(confidence, 0.95); // Cap at 95%

        // Reset self-report timeout on any document change (keeps detection alive during editing)
        this.resetSelfReportTimeout();
        // Remove verbose timeout reset logging

        // Add document changes as a detection event (removed verbose logging)
        this.handleDetectionEvent({
            method: 'document',
            timestamp: Date.now(),
            confidence: confidence,
            data: { 
                changes: event.contentChanges.length,
                totalChars: totalChanges,
                largeChanges,
                rapidChanges,
                fileName: event.document.fileName
            },
            source: 'text-document-change'
        });
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

    // Callback methods for disabled detection removed

    public dispose(): void {
        this.detectionMethods.forEach(method => method.stop());
        this.disposables.forEach(d => d.dispose());
    }

    public get isGenerating(): boolean {
        return this._isGenerating;
    }

    public getDetectionMethods(): { name: string; tier: number; isActive: boolean; confidence: number; lastDetection: Date | null; firing: boolean; error: string | null; lastEvent: DetectionEvent | null }[] {
        return Array.from(this.detectionMethods.entries()).map(([key, method]) => ({
            name: method.name,
            tier: method.tier,
            isActive: method.isActive(),
            confidence: this.methodStatus[key]?.confidence ?? 0,
            lastDetection: this.methodStatus[key]?.lastDetection ? new Date(this.methodStatus[key].lastDetection!) : null,
            firing: this.methodStatus[key]?.firing ?? false,
            error: this.methodStatus[key]?.error ?? null,
            lastEvent: this.methodStatus[key]?.lastEvent ?? null
        }));
    }

    public getStats(): { totalDetections: number; falsePositives: number; confidenceScore: number; performanceImpact: string } {
        const recentEvents = this.detectionEvents.filter(
            event => Date.now() - event.timestamp < this.DETECTION_TIMEOUT
        );

        const confidenceScore = this.calculateAggregateConfidence();
        const performanceImpact = this.calculatePerformanceImpact();

        return {
            totalDetections: this.stats.totalDetections,
            falsePositives: this.stats.falsePositives,
            confidenceScore,
            performanceImpact
        };
    }

    private calculatePerformanceImpact(): string {
        // Simple performance impact calculation based on active methods
        const activeMethods = Array.from(this.detectionMethods.values())
            .filter(method => method.isActive()).length;

        if (activeMethods <= 2) return 'Low';
        if (activeMethods <= 4) return 'Medium';
        return 'High';
    }

    private logDetectorStatus(): void {
        // Only log critical errors, not routine status - removed frequent logging
        const confidence = this.calculateAggregateConfidence();
        
        // Only log critical mismatches that might indicate problems
        if (!this._isGenerating && confidence > 0.8) {
            this.outputChannel.appendLine(`[CursorDetector] Warning: High confidence but not generating`);
        }
        
        // Silent console logging for debugging only
        // console.log(`[CursorDetector] Status: Generating=${this._isGenerating}, Confidence=${(confidence * 100).toFixed(1)}%`);
    }

    public clearStats(): void {
        this.stats = {
            totalDetections: 0,
            falsePositives: 0,
            lastReset: Date.now()
        };
        this.detectionEvents = [];
    }

    // NEW: Selection Change Monitoring methods
    private setupSelectionMonitoring(): void {
        // Reduced setup logging
        try {
            // Track selection changes in all editors
            const selectionDisposable = vscode.window.onDidChangeTextEditorSelection(this.handleSelectionChange, this);
            this.disposables.push(selectionDisposable);
            
            // Also track when active editor changes
            const activeEditorDisposable = vscode.window.onDidChangeActiveTextEditor(() => {
                // Removed verbose logging
            });
            this.disposables.push(activeEditorDisposable);
            
        } catch (error) {
            this.outputChannel.appendLine(`[CursorDetector] Failed to setup selection monitoring: ${error}`);
            this.methodStatus['selection'].error = `Setup failed: ${error}`;
        }
    }

    private handleSelectionChange(event: vscode.TextEditorSelectionChangeEvent): void {
        try {
            // Look for AI-characteristic selection patterns
            const selections = event.selections;
            const kind = event.kind;
            
            // Safety check - avoid processing too many selections at once
            if (selections.length > 10) {
                return; // Ignore excessive selections that might indicate issues
            }
            
            // Calculate confidence based on selection patterns
            let confidence = 0.1; // Lower base confidence
            
            // AI often makes rapid, various-sized selections
            if (selections.length === 1) {
                const selection = selections[0];
                const selectionSize = Math.abs(selection.end.line - selection.start.line) + 
                                    Math.abs(selection.end.character - selection.start.character);
                
                // Lower thresholds for AI detection
                if (selectionSize > 20) {
                    confidence += 0.2; // Medium selection
                }
                
                if (selectionSize > 100) {
                    confidence += 0.2; // Large selection
                }
                
                // Detect rapid small selections (AI often makes precise selections)
                if (selectionSize > 5 && selectionSize < 50) {
                    confidence += 0.15; // Small but significant selections
                }
            }
            
            // Multiple selections might indicate AI activity
            if (selections.length > 1) {
                confidence += 0.2;
            }
            
            // Selection kind can indicate AI activity - monitor ALL kinds
            if (kind === vscode.TextEditorSelectionChangeKind.Command) {
                confidence += 0.15; // Command-driven selection
            } else if (kind === vscode.TextEditorSelectionChangeKind.Keyboard) {
                confidence += 0.1; // Keyboard selection (might be AI-driven)
            } else if (kind === vscode.TextEditorSelectionChangeKind.Mouse) {
                confidence += 0.05; // Mouse selection (less likely AI)
            }
            
            // Only trigger detection for significant selections (removed verbose logging)
            if (confidence >= 0.3) {
                this.handleDetectionEvent({
                    method: 'selection',
                    timestamp: Date.now(),
                    confidence: confidence,
                    data: { 
                        selectionCount: selections.length,
                        firstSelectionSize: selections.length > 0 ? 
                            Math.abs(selections[0].end.line - selections[0].start.line) + 
                            Math.abs(selections[0].end.character - selections[0].start.character) : 0,
                        allSelectionSizes: selections.map(s => 
                            Math.abs(s.end.line - s.start.line) + 
                            Math.abs(s.end.character - s.start.character)
                        )
                    },
                    source: 'selection-change'
                });
            }
        } catch (error) {
            // Silently handle errors to prevent crashes
            this.outputChannel.appendLine(`[CursorDetector] Error in selection change handler: ${error}`);
        }
    }

    private cleanupSelectionMonitoring(): void {
        // Selection monitoring disposables are handled by the main disposables array
    }

    private onSelectionChange(callback: (event: DetectionEvent) => void): void {
        // Selection changes are handled directly in handleSelectionChange
    }

    // LSP and File System monitoring methods removed (were disabled)

    // NEW: Chat/Focus Change Detection methods
    private setupChatDetection(): void {
        // Reduced setup logging
        try {
            // Monitor when focus leaves the active text editor (might indicate chat usage)
            const activeEditorDisposable = vscode.window.onDidChangeActiveTextEditor(this.handleEditorFocusChange, this);
            this.disposables.push(activeEditorDisposable);
            
            // Monitor window focus changes
            const windowStateDisposable = vscode.window.onDidChangeWindowState(this.handleWindowStateChange, this);
            this.disposables.push(windowStateDisposable);
            
            // List all available commands to find chat-related ones
            this.discoverChatCommands();
            
        } catch (error) {
            this.outputChannel.appendLine(`[CursorDetector] Failed to setup chat detection: ${error}`);
            this.methodStatus['chat'].error = `Setup failed: ${error}`;
        }
    }

    private handleEditorFocusChange(editor: vscode.TextEditor | undefined): void {
        try {
            if (!editor) {
                // Focus moved away from editor - could be chat interaction
                this.handleDetectionEvent({
                    method: 'chat',
                    timestamp: Date.now(),
                    confidence: 0.4, // Medium confidence for focus changes
                    data: { 
                        type: 'focus-left-editor',
                        editorCount: vscode.window.visibleTextEditors.length
                    },
                    source: 'editor-focus-change'
                });
            } else {
                // Focus returned to editor - chat interaction might be ending
                this.handleDetectionEvent({
                    method: 'chat',
                    timestamp: Date.now(),
                    confidence: 0.2, // Lower confidence for focus return
                    data: { 
                        type: 'focus-returned-to-editor',
                        fileName: editor.document.fileName
                    },
                    source: 'editor-focus-return'
                });
            }
        } catch (error) {
            this.outputChannel.appendLine(`[CursorDetector] Error in editor focus change handler: ${error}`);
        }
    }

    private handleWindowStateChange(state: vscode.WindowState): void {
        try {
            if (!state.focused) {
                // Window lost focus - user might be in external chat or other app
                this.handleDetectionEvent({
                    method: 'chat',
                    timestamp: Date.now(),
                    confidence: 0.15, // Low confidence for window focus loss
                    data: { 
                        type: 'window-focus-lost'
                    },
                    source: 'window-state-change'
                });
            }
        } catch (error) {
            this.outputChannel.appendLine(`[CursorDetector] Error in window state change handler: ${error}`);
        }
    }

    private async discoverChatCommands(): Promise<void> {
        try {
            const allCommands = await vscode.commands.getCommands();
            const chatRelatedCommands = allCommands.filter(cmd => 
                cmd.includes('chat') || 
                cmd.includes('ai') || 
                cmd.includes('generate') ||
                cmd.includes('cursor') ||
                cmd.includes('completion')
            );
            
            // Try to register listeners for promising commands
            this.setupChatCommandListeners(chatRelatedCommands);
            
        } catch (error) {
            this.outputChannel.appendLine(`[CursorDetector] Error discovering chat commands: ${error}`);
        }
    }

    private setupChatCommandListeners(commands: string[]): void {
        // Look for the most promising chat-related commands
        const highPriorityChatCommands = commands.filter(cmd => 
            cmd.includes('chat.open') ||
            cmd.includes('chat.submit') ||
            cmd.includes('ai.generate') ||
            cmd.includes('cursor.chat') ||
            cmd.includes('workbench.action.chat')
        );
        
        // Note: We can't actually intercept these due to VS Code API limitations
    }

    private cleanupChatDetection(): void {
        // Chat detection disposables are handled by the main disposables array
    }

    private onChatActivity(callback: (event: DetectionEvent) => void): void {
        // Chat activity is handled directly in focus change handlers
    }

    // NEW: AI Self-Reporting Detection methods
    private selfReportTimeout: NodeJS.Timeout | null = null;
    private readonly SELF_REPORT_TIMEOUT_MS = 60000; // 60 seconds

    private setupSelfReportDetection(): void {
        // Minimal setup logging
        this.outputChannel.appendLine('[CursorDetector] Setting up AI self-report detection...');
        try {
            // Get workspace folder
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                throw new Error('No workspace folder found');
            }
            
            // Create file watcher for .cursor/is_working
            const isWorkingPath = vscode.Uri.joinPath(workspaceFolder.uri, '.cursor', 'is_working');
            const pattern = new vscode.RelativePattern(workspaceFolder, '.cursor/is_working');
            
            // Create file watcher - reduced logging
            const fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
            
            // Handle file changes with minimal logging
            fileWatcher.onDidChange((uri) => {
                this.handleIsWorkingFileChange(uri);
            });
            
            fileWatcher.onDidCreate((uri) => {
                this.handleIsWorkingFileChange(uri);
            });
            
            fileWatcher.onDidDelete((uri) => {
                // File deleted - AI is idle
                this.handleDetectionEvent({
                    method: 'selfReport',
                    timestamp: Date.now(),
                    confidence: 0.01, // AI is idle if file is deleted
                    data: { 
                        isWorking: false,
                        fileContent: null,
                        fileDeleted: true,
                        filePath: uri.fsPath
                    },
                    source: 'ai-self-report-deleted'
                });
            });
            
            this.disposables.push(fileWatcher);
            
            // Read initial state
            this.readIsWorkingFile(isWorkingPath);
            
            // Set up periodic polling as backup (every 2 seconds)
            const pollingInterval = setInterval(() => {
                this.readIsWorkingFile(isWorkingPath);
            }, 2000);
            
            // Store interval for cleanup
            this.disposables.push({
                dispose: () => {
                    clearInterval(pollingInterval);
                }
            });
            
            // Start timeout monitoring
            this.startSelfReportTimeout();
            
            this.outputChannel.appendLine('[CursorDetector] ✅ AI Self-Report Detection Active');
            
        } catch (error) {
            this.outputChannel.appendLine(`[CursorDetector] Failed to setup self-report detection: ${error}`);
            this.methodStatus['selfReport'].error = `Setup failed: ${error}`;
        }
    }

    private async handleIsWorkingFileChange(uri: vscode.Uri): Promise<void> {
        try {
            // Reset timeout on any file change
            this.resetSelfReportTimeout();
            
            // Small delay to ensure file write is complete
            await new Promise(resolve => setTimeout(resolve, 50));
            
            await this.readIsWorkingFile(uri);
        } catch (error) {
            this.outputChannel.appendLine(`[CursorDetector] Error handling is_working file change: ${error}`);
        }
    }

    private async readIsWorkingFile(uri: vscode.Uri): Promise<void> {
        try {
            // Read file contents
            const fileContents = await vscode.workspace.fs.readFile(uri);
            const content = Buffer.from(fileContents).toString('utf8').trim();
            
            // Parse boolean status
            const isWorking = content.toLowerCase() === 'true';
            const confidence = isWorking ? 0.99 : 0.01;
            
            // Create detection event with high confidence (this is direct from AI)
            this.handleDetectionEvent({
                method: 'selfReport',
                timestamp: Date.now(),
                confidence: confidence, // Very high confidence when working, very low when idle
                data: { 
                    isWorking,
                    fileContent: content,
                    filePath: uri.fsPath
                },
                source: 'ai-self-report'
            });
            
        } catch (error) {
            // Silent error handling - just assume AI is idle
            this.handleDetectionEvent({
                method: 'selfReport',
                timestamp: Date.now(),
                confidence: 0.01, // Very low confidence - AI is idle
                data: { 
                    isWorking: false,
                    fileContent: null,
                    error: error instanceof Error ? error.message : String(error)
                },
                source: 'ai-self-report-error'
            });
        }
    }

    private startSelfReportTimeout(): void {
        this.clearSelfReportTimeout(); // Clear any existing timeout
        
        this.selfReportTimeout = setTimeout(() => {
            // Create timeout detection event - assume AI is idle
            this.handleDetectionEvent({
                method: 'selfReport',
                timestamp: Date.now(),
                confidence: 0.01, // Very low confidence - AI is assumed idle due to timeout
                data: { 
                    isWorking: false,
                    fileContent: null,
                    timeoutTriggered: true,
                    timeoutDuration: this.SELF_REPORT_TIMEOUT_MS
                },
                source: 'ai-self-report-timeout'
            });
            
            this.selfReportTimeout = null;
        }, this.SELF_REPORT_TIMEOUT_MS);
    }

    private resetSelfReportTimeout(): void {
        this.startSelfReportTimeout(); // Restart the timeout
    }

    private clearSelfReportTimeout(): void {
        if (this.selfReportTimeout) {
            clearTimeout(this.selfReportTimeout);
            this.selfReportTimeout = null;
        }
    }

    private cleanupSelfReportDetection(): void {
        // Clear timeout on cleanup
        this.clearSelfReportTimeout();
        
        // File watcher disposables are handled by the main disposables array
    }

    private onSelfReportChange(callback: (event: DetectionEvent) => void): void {
        // Self-report changes are handled directly in file change handlers
    }
} 