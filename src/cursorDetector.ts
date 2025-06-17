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
        this.outputChannel.appendLine('[CursorDetector] Initializing...');
        console.log('[CursorDetector] Constructor called');

        // Debounce the end generation function to only fire after 500ms of inactivity
        this.debouncedEndGeneration = debounce(() => {
            this.outputChannel.appendLine('[CursorDetector] Debounced end generation triggered');
            this.endGeneration();
        }, 500);

        this.initializeDetectionMethods();
        this.setupEventListeners();
        
        // Start periodic logging to show detector is alive
        setInterval(() => {
            this.logDetectorStatus();
        }, 30000); // Every 30 seconds
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
            name: 'AI Self-Reporting (.is_working)',
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

        this.outputChannel.appendLine('[CursorDetector] Now monitoring for AI activity.');
    }

    // Disabled detection methods removed for cleaner codebase

    private handleDetectionEvent(event: DetectionEvent): void {
        this.outputChannel.appendLine(`[CursorDetector] === DETECTION EVENT ===`);
        this.outputChannel.appendLine(`  Method: ${event.method}`);
        this.outputChannel.appendLine(`  Source: ${event.source}`);
        this.outputChannel.appendLine(`  Confidence: ${(event.confidence * 100).toFixed(1)}%`);
        this.outputChannel.appendLine(`  Data: ${JSON.stringify(event.data)}`);
        
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
            this.outputChannel.appendLine(`  Updated method status for: ${event.method}`);
        } else {
            this.outputChannel.appendLine(`  WARNING: Unknown method: ${event.method}`);
        }
        
        // Reset firing state for other methods
        Object.keys(this.methodStatus).forEach(key => {
            if (key !== event.method) {
                this.methodStatus[key].firing = false;
            }
        });

        // Calculate aggregate confidence
        const confidence = this.calculateAggregateConfidence();
        this.outputChannel.appendLine(`  Aggregate confidence: ${(confidence * 100).toFixed(1)}%`);
        this.outputChannel.appendLine(`  Threshold: ${(this.DETECTION_THRESHOLD * 100).toFixed(1)}%`);
        this.outputChannel.appendLine(`  Currently generating: ${this._isGenerating}`);
        
        if (confidence >= this.DETECTION_THRESHOLD && !this._isGenerating) {
            this.outputChannel.appendLine(`  🟢 TRIGGERING AI GENERATION START`);
            this.startGeneration();
        } else if (confidence < this.DETECTION_THRESHOLD && this._isGenerating) {
            this.outputChannel.appendLine(`  🟡 SCHEDULING AI GENERATION END (debounced)`);
            this.debouncedEndGeneration();
        } else {
            this.outputChannel.appendLine(`  🔴 NO ACTION TAKEN`);
            if (confidence < this.DETECTION_THRESHOLD) {
                this.outputChannel.appendLine(`    Reason: Confidence too low (${(confidence * 100).toFixed(1)}% < ${(this.DETECTION_THRESHOLD * 100).toFixed(1)}%)`);
            }
            if (this._isGenerating && confidence >= this.DETECTION_THRESHOLD) {
                this.outputChannel.appendLine(`    Reason: Already generating`);
            }
        }
        
        this.outputChannel.appendLine(`[CursorDetector] === END DETECTION EVENT ===`);
    }

    private calculateAggregateConfidence(): number {
        if (this.detectionEvents.length === 0) return 0;

        const recentEvents = this.detectionEvents.filter(
            event => Date.now() - event.timestamp < this.DETECTION_TIMEOUT
        );

        if (recentEvents.length === 0) return 0;

        const totalConfidence = recentEvents.reduce(
            (sum, event) => sum + event.confidence,
            0
        );

        return totalConfidence / recentEvents.length;
    }

    // Cleanup methods for disabled detection removed

    private handleTextDocumentChange(event: vscode.TextDocumentChangeEvent): void {
        if (event.document.uri.scheme !== 'file') {
            // Don't spam the log for non-file changes (output panels, etc.)
            return;
        }

        if (event.contentChanges.length === 0) {
            // Don't log empty changes
            return;
        }

        // Analyze the changes for AI patterns
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

        this.outputChannel.appendLine(`[CursorDetector] Document change detected:`);
        this.outputChannel.appendLine(`  - File: ${event.document.fileName}`);
        this.outputChannel.appendLine(`  - Changes: ${event.contentChanges.length}`);
        this.outputChannel.appendLine(`  - Total chars: ${totalChanges}`);
        this.outputChannel.appendLine(`  - Large changes (>50 chars): ${largeChanges}`);
        this.outputChannel.appendLine(`  - Rapid changes (>200 chars): ${rapidChanges}`);

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

        this.outputChannel.appendLine(`  - Calculated confidence: ${(confidence * 100).toFixed(1)}%`);

        // Add document changes as a detection event
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
        this.outputChannel.appendLine('[CursorDetector] AI Generation started.');
        this._onAiGenerationStart.fire();
    }

    private endGeneration(): void {
        if (this._isGenerating) {
            this._isGenerating = false;
            this.outputChannel.appendLine('[CursorDetector] AI Generation ended.');
            this._onAiGenerationEnd.fire();
        }
    }

    // Callback methods for disabled detection removed

    public dispose(): void {
        this.outputChannel.appendLine('[CursorDetector] Disposing...');
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
        const confidence = this.calculateAggregateConfidence();
        const recentEvents = this.detectionEvents.filter(
            event => Date.now() - event.timestamp < this.DETECTION_TIMEOUT
        );
        
        this.outputChannel.appendLine(`[CursorDetector] Status Check:`);
        this.outputChannel.appendLine(`  - Is Generating: ${this._isGenerating}`);
        this.outputChannel.appendLine(`  - Total Detection Events: ${this.detectionEvents.length}`);
        this.outputChannel.appendLine(`  - Recent Events (5s): ${recentEvents.length}`);
        this.outputChannel.appendLine(`  - Current Confidence: ${(confidence * 100).toFixed(1)}%`);
        this.outputChannel.appendLine(`  - Detection Threshold: ${(this.DETECTION_THRESHOLD * 100).toFixed(1)}%`);
        
        // Log method status
        Object.entries(this.methodStatus).forEach(([method, status]) => {
            const lastTime = status.lastDetection ? `${Math.round((Date.now() - status.lastDetection) / 1000)}s ago` : 'Never';
            const firing = status.firing ? '🟢' : '🔴';
            this.outputChannel.appendLine(`  - ${method}: ${firing} Confidence: ${(status.confidence * 100).toFixed(1)}% Last: ${lastTime}`);
        });
        
        console.log(`[CursorDetector] Status: Generating=${this._isGenerating}, Confidence=${(confidence * 100).toFixed(1)}%, Events=${recentEvents.length}`);
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
        this.outputChannel.appendLine('[CursorDetector] Setting up selection change monitoring...');
        
        try {
            // Track selection changes in all editors
            const selectionDisposable = vscode.window.onDidChangeTextEditorSelection(this.handleSelectionChange, this);
            this.disposables.push(selectionDisposable);
            
            // Also track when active editor changes
            const activeEditorDisposable = vscode.window.onDidChangeActiveTextEditor(() => {
                this.outputChannel.appendLine('[CursorDetector] Active editor changed - resetting selection tracking');
            });
            this.disposables.push(activeEditorDisposable);
            
            this.outputChannel.appendLine('[CursorDetector] Selection change monitoring setup complete');
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
                    confidence += 0.2; // Medium selection (lowered from 100)
                }
                
                if (selectionSize > 100) {
                    confidence += 0.2; // Large selection (still detect these)
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
            
            // FIXED: Lower threshold (0.3 instead of 0.5) and remove random sampling
            if (confidence >= 0.3) {
                this.outputChannel.appendLine(`[CursorDetector] 🎯 SELECTION CHANGE DETECTED:`);
                this.outputChannel.appendLine(`  - Selections: ${selections.length}`);
                this.outputChannel.appendLine(`  - Kind: ${kind}`);
                this.outputChannel.appendLine(`  - Confidence: ${(confidence * 100).toFixed(1)}%`);
                this.outputChannel.appendLine(`  - First selection size: ${selections.length > 0 ? Math.abs(selections[0].end.line - selections[0].start.line) + Math.abs(selections[0].end.character - selections[0].start.character) : 0}`);
                
                this.handleDetectionEvent({
                    method: 'selection',
                    timestamp: Date.now(),
                    confidence: confidence,
                    data: { 
                        selectionCount: selections.length,
                        kind: kind,
                        // Store detailed selection data for analysis
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
            } else {
                // Log all selection events occasionally for debugging patterns
                if (Math.random() < 0.02) { // 2% chance for pattern analysis
                    this.outputChannel.appendLine(`[CursorDetector] Selection (low confidence ${(confidence * 100).toFixed(1)}%): ${selections.length} selections, kind: ${kind}`);
                }
            }
        } catch (error) {
            // Silently handle errors to prevent crashes
            this.outputChannel.appendLine(`[CursorDetector] Error in selection change handler: ${error}`);
        }
    }

    private cleanupSelectionMonitoring(): void {
        // Selection monitoring disposables are handled by the main disposables array
        this.outputChannel.appendLine('[CursorDetector] Selection monitoring cleaned up');
    }

    private onSelectionChange(callback: (event: DetectionEvent) => void): void {
        // Selection changes are handled directly in handleSelectionChange
        this.outputChannel.appendLine('[CursorDetector] Selection change callback registered');
    }

    // LSP and File System monitoring methods removed (were disabled)

    // NEW: Chat/Focus Change Detection methods
    private setupChatDetection(): void {
        this.outputChannel.appendLine('[CursorDetector] Setting up chat/focus change detection...');
        
        try {
            // Monitor when focus leaves the active text editor (might indicate chat usage)
            const activeEditorDisposable = vscode.window.onDidChangeActiveTextEditor(this.handleEditorFocusChange, this);
            this.disposables.push(activeEditorDisposable);
            
            // Monitor window focus changes
            const windowStateDisposable = vscode.window.onDidChangeWindowState(this.handleWindowStateChange, this);
            this.disposables.push(windowStateDisposable);
            
            // List all available commands to find chat-related ones
            this.discoverChatCommands();
            
            this.outputChannel.appendLine('[CursorDetector] Chat/focus change detection setup complete');
        } catch (error) {
            this.outputChannel.appendLine(`[CursorDetector] Failed to setup chat detection: ${error}`);
            this.methodStatus['chat'].error = `Setup failed: ${error}`;
        }
    }

    private handleEditorFocusChange(editor: vscode.TextEditor | undefined): void {
        try {
            if (!editor) {
                // Focus moved away from editor - could be chat interaction
                this.outputChannel.appendLine('[CursorDetector] 💬 FOCUS LEFT EDITOR - Possible chat interaction');
                
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
                this.outputChannel.appendLine('[CursorDetector] Focus returned to editor');
                
                // Lower confidence event for focus return
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
            this.outputChannel.appendLine(`[CursorDetector] Window state changed - focused: ${state.focused}`);
            
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
            this.outputChannel.appendLine('[CursorDetector] Discovering available chat commands...');
            
            const allCommands = await vscode.commands.getCommands();
            const chatRelatedCommands = allCommands.filter(cmd => 
                cmd.includes('chat') || 
                cmd.includes('ai') || 
                cmd.includes('generate') ||
                cmd.includes('cursor') ||
                cmd.includes('completion')
            );
            
            this.outputChannel.appendLine(`[CursorDetector] Found ${chatRelatedCommands.length} potentially chat-related commands:`);
            chatRelatedCommands.forEach(cmd => {
                this.outputChannel.appendLine(`  - ${cmd}`);
            });
            
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
        
        if (highPriorityChatCommands.length > 0) {
            this.outputChannel.appendLine(`[CursorDetector] High-priority chat commands found: ${highPriorityChatCommands.join(', ')}`);
            
            // Note: We can't actually intercept these due to VS Code API limitations,
            // but we can log them for research purposes
            this.outputChannel.appendLine('[CursorDetector] Note: Command interception not possible due to VS Code API limitations');
        } else {
            this.outputChannel.appendLine('[CursorDetector] No high-priority chat commands found');
        }
    }

    private cleanupChatDetection(): void {
        // Chat detection disposables are handled by the main disposables array
        this.outputChannel.appendLine('[CursorDetector] Chat/focus change detection cleaned up');
    }

    private onChatActivity(callback: (event: DetectionEvent) => void): void {
        // Chat activity is handled directly in focus change handlers
        this.outputChannel.appendLine('[CursorDetector] Chat activity callback registered');
    }

    // NEW: AI Self-Reporting Detection methods
    private selfReportTimeout: NodeJS.Timeout | null = null;
    private readonly SELF_REPORT_TIMEOUT_MS = 60000; // 60 seconds

    private setupSelfReportDetection(): void {
        this.outputChannel.appendLine('[CursorDetector] Setting up AI self-reporting detection...');
        
        try {
            // Get workspace folder
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                throw new Error('No workspace folder found');
            }
            
            // Create file watcher for .cursor/.is_working
            const isWorkingPath = vscode.Uri.joinPath(workspaceFolder.uri, '.cursor', '.is_working');
            const pattern = new vscode.RelativePattern(workspaceFolder, '.cursor/.is_working');
            
            this.outputChannel.appendLine(`[CursorDetector] Watching file: ${isWorkingPath.fsPath}`);
            
            // Create file watcher
            const fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
            
            // Handle file changes
            fileWatcher.onDidChange(this.handleIsWorkingFileChange, this);
            fileWatcher.onDidCreate(this.handleIsWorkingFileChange, this);
            
            this.disposables.push(fileWatcher);
            
            // Read initial state
            this.readIsWorkingFile(isWorkingPath);
            
            // Start timeout monitoring
            this.startSelfReportTimeout();
            
            this.outputChannel.appendLine('[CursorDetector] AI self-reporting detection setup complete with 60s timeout');
        } catch (error) {
            this.outputChannel.appendLine(`[CursorDetector] Failed to setup self-report detection: ${error}`);
            this.methodStatus['selfReport'].error = `Setup failed: ${error}`;
        }
    }

    private async handleIsWorkingFileChange(uri: vscode.Uri): Promise<void> {
        try {
            this.outputChannel.appendLine(`[CursorDetector] 🤖 AI STATUS FILE CHANGED: ${uri.fsPath}`);
            
            // Reset timeout on any file change
            this.resetSelfReportTimeout();
            
            await this.readIsWorkingFile(uri);
        } catch (error) {
            this.outputChannel.appendLine(`[CursorDetector] Error handling .is_working file change: ${error}`);
        }
    }

    private async readIsWorkingFile(uri: vscode.Uri): Promise<void> {
        try {
            // Read file contents
            const fileContents = await vscode.workspace.fs.readFile(uri);
            const content = Buffer.from(fileContents).toString('utf8').trim();
            
            this.outputChannel.appendLine(`[CursorDetector] .is_working file content: "${content}"`);
            
            // Parse boolean status
            const isWorking = content.toLowerCase() === 'true';
            
            this.outputChannel.appendLine(`[CursorDetector] 🤖 AI SELF-REPORT: ${isWorking ? 'WORKING' : 'IDLE'}`);
            
            // Create detection event with high confidence (this is direct from AI)
            this.handleDetectionEvent({
                method: 'selfReport',
                timestamp: Date.now(),
                confidence: isWorking ? 0.99 : 0.01, // Very high confidence when working, very low when idle
                data: { 
                    isWorking,
                    fileContent: content,
                    filePath: uri.fsPath
                },
                source: 'ai-self-report'
            });
            
        } catch (error) {
            this.outputChannel.appendLine(`[CursorDetector] Error reading .is_working file: ${error}`);
            
            // If file doesn't exist, assume AI is idle
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
            this.outputChannel.appendLine('[CursorDetector] ⏰ AI SELF-REPORT TIMEOUT (60s) - Assuming AI is idle');
            
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
        
        this.outputChannel.appendLine(`[CursorDetector] Started AI self-report timeout (${this.SELF_REPORT_TIMEOUT_MS}ms)`);
    }

    private resetSelfReportTimeout(): void {
        this.outputChannel.appendLine('[CursorDetector] Resetting AI self-report timeout due to file change');
        this.startSelfReportTimeout(); // Restart the timeout
    }

    private clearSelfReportTimeout(): void {
        if (this.selfReportTimeout) {
            clearTimeout(this.selfReportTimeout);
            this.selfReportTimeout = null;
            this.outputChannel.appendLine('[CursorDetector] Cleared AI self-report timeout');
        }
    }

    private cleanupSelfReportDetection(): void {
        // Clear timeout on cleanup
        this.clearSelfReportTimeout();
        
        // File watcher disposables are handled by the main disposables array
        this.outputChannel.appendLine('[CursorDetector] AI self-reporting detection cleaned up');
    }

    private onSelfReportChange(callback: (event: DetectionEvent) => void): void {
        // Self-report changes are handled directly in file change handlers
        this.outputChannel.appendLine('[CursorDetector] AI self-report callback registered');
    }
} 