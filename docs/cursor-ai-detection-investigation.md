# Cursor AI Detection Methods Investigation

## Overview
This document outlines various approaches to detect when Cursor AI starts and completes code generation, based on research and available documentation.

## Detection Methods

### 1. DOM Monitoring Approach

Since Cursor is a fork of VS Code, it inherits many VS Code UI patterns. We can monitor DOM mutations to detect AI activity:

```typescript
// Monitor for Cursor-specific UI elements
const setupDomObserver = () => {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            // Look for chat panel activity
            if (mutation.target.classList?.contains('inline-chat-widget') ||
                mutation.target.querySelector('.inline-chat-progress')) {
                console.log('AI generation detected via DOM');
            }
            
            // Check for loading indicators
            const loadingElements = document.querySelectorAll(
                '.monaco-progress-container, .cursor-loading-indicator'
            );
            if (loadingElements.length > 0) {
                console.log('Loading state detected');
            }
        });
    });
    
    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style']
    });
};
```

**Pros:**
- Direct observation of UI changes
- No dependency on internal APIs
- Works across Cursor versions

**Cons:**
- UI elements may change between versions
- May have false positives
- Requires continuous DOM monitoring

### 2. VS Code Extension API Monitoring

Monitor document changes and editor state through VS Code APIs:

```typescript
import * as vscode from 'vscode';

const detectAIGeneration = () => {
    // Monitor document changes
    vscode.workspace.onDidChangeTextDocument((event) => {
        // Detect rapid, large changes characteristic of AI generation
        if (event.contentChanges.length > 0) {
            const change = event.contentChanges[0];
            const isLargeChange = change.text.length > 50;
            const isRapidChange = /* timing logic */;
            
            if (isLargeChange && isRapidChange) {
                console.log('Possible AI generation detected');
            }
        }
    });
    
    // Monitor selection changes (AI often selects generated code)
    vscode.window.onDidChangeTextEditorSelection((event) => {
        // AI generation often creates specific selection patterns
    });
};
```

**Pros:**
- Uses stable VS Code APIs
- Can detect actual code changes
- Works at the editor level

**Cons:**
- Indirect detection
- May miss some AI activities
- Difficult to distinguish from paste operations

### 3. Command Interception

Wrap or monitor Cursor-specific commands:

```typescript
const interceptCursorCommands = () => {
    // Common Cursor AI commands
    const cursorCommands = [
        'cursor.action.generateCode',
        'cursor.action.chat',
        'cursor.inline.completion.trigger',
        'workbench.action.chat.open'
    ];
    
    cursorCommands.forEach(cmd => {
        vscode.commands.registerCommand(`${cmd}.wrapped`, async (...args) => {
            console.log(`AI command triggered: ${cmd}`);
            // Show game
            await showGamePanel();
            
            // Execute original command
            try {
                const result = await vscode.commands.executeCommand(cmd, ...args);
                return result;
            } finally {
                // Hide game when done
                await hideGamePanel();
            }
        });
    });
};
```

**Pros:**
- Direct interception of AI triggers
- Clean start/end detection
- Works with keyboard shortcuts

**Cons:**
- Commands may change
- Requires knowledge of internal commands
- May not catch all AI activities

### 4. Network Request Monitoring (Limited)

While we can't directly intercept network requests from an extension, we can:

```typescript
// Monitor for side effects of network activity
const monitorNetworkActivity = () => {
    // Check status bar items
    const statusBarItems = vscode.window.statusBarItems;
    
    // Look for progress notifications
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Monitoring AI activity"
    }, async (progress) => {
        // Monitor for AI-related progress
    });
};
```

### 5. Hybrid Approach (Recommended)

Combine multiple detection methods for reliability:

```typescript
class CursorAIDetector {
    private isGenerating = false;
    private detectionMethods: Array<() => void> = [];
    
    constructor() {
        this.setupDomObserver();
        this.setupCommandInterception();
        this.setupDocumentMonitoring();
    }
    
    private onGenerationStart() {
        if (!this.isGenerating) {
            this.isGenerating = true;
            // Trigger game display
        }
    }
    
    private onGenerationEnd() {
        if (this.isGenerating) {
            this.isGenerating = false;
            // Hide game
        }
    }
}
```

## Technical Challenges

### 1. Cursor vs VS Code Differences
- Cursor uses custom UI components not in standard VS Code
- Internal APIs are not documented
- Updates may break detection methods

### 2. Timing Issues
- Need to detect start/end accurately
- Avoid flickering for very short generations
- Handle cancelled generations

### 3. Context Switching
- Multiple files/tabs being edited
- Chat vs inline generation
- Multiple Cursor windows

## Recommended Implementation Strategy

1. **Start with DOM Monitoring**
   - Most reliable for UI-based detection
   - Can identify specific Cursor elements

2. **Add Command Interception**
   - Catch explicit user actions
   - Good for keyboard shortcuts

3. **Implement Debouncing**
   - Avoid false positives
   - Smooth game show/hide

4. **Add Configuration**
   - Let users tune detection sensitivity
   - Enable/disable specific methods

## Testing Approach

1. **Manual Testing Scenarios**
   - Inline completion (Cmd+K)
   - Chat panel generation
   - Multi-file edits
   - Quick successive generations

2. **Performance Testing**
   - Monitor CPU usage of detection
   - Ensure no impact on typing performance
   - Test with large codebases

3. **Compatibility Testing**
   - Different Cursor versions
   - Various themes and UI scales
   - Multiple monitor setups

## Next Steps

1. Build a prototype with DOM monitoring
2. Test with actual Cursor installation
3. Identify specific CSS classes and DOM structures
4. Implement fallback detection methods
5. Create configuration options for users

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [VS Code WebView API](https://code.visualstudio.com/api/extension-guides/webview)
- [MutationObserver API](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)
- CodeCursor Extension (for reference implementation) 