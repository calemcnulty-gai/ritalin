# Ritalin for Cursor

- Owners
  - Cale McNulty
- Purpose
  - Developers waste 5-10 minutes per context switch when waiting for AI code generation, destroying flow state and productivity. Current wait times of 15-60 seconds trigger habitual tab switching to social media.
  - We'll keep developers focused by automatically displaying engaging mini-games during AI generation periods, transforming dead time into productive micro-gaming sessions without leaving the IDE.
  - In scope
    - Detecting Cursor AI generation states
    - Embedding web-based games in WebView panels (using VS Code extension API)
    - State persistence between gaming sessions
    - Focus metrics and productivity tracking
  - Out of scope
    - Other IDEs or AI coding assistants (GitHub Copilot in VS Code, etc.)
    - Desktop/mobile apps outside Cursor
    - Building custom games (using existing web games)
    - Multiplayer or social features (MVP)
- Experts
  - VS Code Extension Development
    - [VS Code Extension API Docs](https://code.visualstudio.com/api)
    - [WebView API Guide](https://code.visualstudio.com/api/extension-guides/webview)
  - Game Embedding & Web Technologies
    - [itch.io Embedding Guide](https://itch.io/docs/creators/widget)
    - [BeautifulSoup Documentation](https://www.crummy.com/software/BeautifulSoup/bs4/doc/) - HTML parsing for game extraction
    - [Unity WebGL Build Settings](https://docs.unity3d.com/Manual/webgl-building.html) - Understanding game structure
  - Productivity & Flow State
    - Cal Newport - Deep Work concepts
    - Mihaly Csikszentmihalyi - Flow state research
  - Cursor AI Integration
    - [Cursor Forums](https://forum.cursor.sh/)
    - Cursor Discord community
    - [CodeCursor Extension](https://github.com/Helixform/CodeCursor) - Reference implementation
    - [Cursor Documentation](https://docs.cursor.com/)
- Knowledge Tree
  - Detection Methods
    - DOM Mutation Observers
      - Monitor chat panel for loading states
      - Watch for specific CSS class changes
      - Look for `.inline-chat-widget`, `.inline-chat-progress`
      - Check for `.monaco-progress-container`
    - Command Interception
      - `cursor.action.generateCode`
      - `cursor.action.chat`
      - `cursor.inline.completion.trigger`
      - `workbench.action.chat.open`
    - Document Change Monitoring
      - Detect rapid, large text changes
      - Track selection patterns
      - Differentiate from paste operations
    - Network Request Interception
      - Monitor API calls to AI endpoints
      - Track request/response patterns
    - VS Code Activity Monitoring
      - Extension activation events
      - Editor state changes
    - DOM Monitoring: Look for `.inline-chat-widget`, `.inline-chat-progress`
    - Command Interception: `cursor.action.generateCode`, `cursor.action.chat`
    - Document Change Patterns: Rapid, large edits without user input
    - **Shadow Workspace Detection**: Hidden Electron windows spawned for AI iteration
    - **Process Monitoring**: Detect Cursor-specific processes and hidden windows
    - **Extension Host IPC**: Monitor message ports and gRPC communication
  - Game Integration Approaches
    - Iframe: For embedding external content (itch.io games)
      - CORS Challenge: Many sites block embedding, need Cross-Origin-Resource-Policy
      - Workaround: Bundle games locally or use permissive hosts
    - Direct HTML: For custom mini-games
    - Canvas/WebGL: For performance-critical games
  - State Management
    - WebView State: Use vscode.setState() for game progress persistence
    - Extension State: context.workspaceState for statistics and settings
    - Auto-pause: Implement when WebView is hidden to save resources
  - Performance Optimization
    - Lazy load game resources
    - Dispose WebViews when not needed
    - Limit concurrent WebView instances
    - Use local resources whenever possible
  - Security
    - Always validate message data between WebView and extension
    - Use strict CSP policies
    - Limit localResourceRoots to specific directories
    - Sanitize any user input
  - VS Code Extension Development
    - **WebView API**: `vscode.window.createWebviewPanel()` creates isolated HTML contexts
    - **Extension Lifecycle**: `activate()` called on extension load, `deactivate()` on unload
    - **Command Registration**: `vscode.commands.registerCommand()` for user-invokable actions
    - **Configuration**: `vscode.workspace.getConfiguration()` for user settings
    - **TypeScript Setup**: Requires @types/vscode, proper tsconfig.json, and compilation to out/ directory
    - **Packaging**: vsce (VS Code Extension CLI) creates .vsix files for distribution
    - **File Exclusion**: .vscodeignore controls what gets included in package (critical for size)
    - **Activation Events**: onStartupFinished, onCommand, etc. control when extension loads
  - Cursor AI Detection Methods
  - **VS Code WebView Security Model**
    - Strict Content Security Policy (CSP) by default
    - No service workers allowed
    - Limited access to local resources via `asWebviewUri`
    - Sandboxed iframe environment
  - **Unity WebGL Requirements**
    - Requires service workers for asset loading
    - Uses complex WASM loading mechanisms
    - Needs specific server headers for compression
    - Large asset files (often 30MB+)
  - **Alternative Game Engines for WebView**
    - Phaser.js - lightweight, WebView-friendly
    - Construct 3 exports - work well in sandboxed environments
    - Pure HTML5/Canvas games - no special requirements
    - PICO-8 exports - small, self-contained
- Insights
  - The problem isn't the wait time itself, it's what developers do during the wait time
  - Context switching during AI generation breaks flow state more than the generation delay
  - Mini-games provide structured distraction that maintains engagement without deep context switching
  - VS Code extensions have surprisingly robust capabilities for embedding interactive content
  - WebView panels provide complete HTML5 environment suitable for game embedding
  - Micro-gaming sessions can maintain cognitive engagement without deep context switching
  - Game state persistence is crucial - nobody wants to restart from level 1 every time
  - Attention != Productivity: Sometimes a strategic distraction improves overall output
  - Flow State Preservation: Games can maintain engagement during necessary waits
  - State Management Critical: Must handle show/hide cycles gracefully
  - **CORS is Absolute**: itch.io and most game hosts have strict CSP policies that cannot be bypassed through browser tricks
  - **Local Hosting is Perfect**: Self-hosting Unity WebGL games eliminates all CORS issues and provides full control
  - **Game Size Acceptable**: Unity WebGL games (~50-100MB) are reasonable for local storage in modern development environments
  - **Automation Possible**: Can reliably extract and download games from itch.io using iframe URL detection and asset parsing
  - **Cursor Uses VS Code Engine**: Cursor is a VS Code fork and uses the same extension API and engine specifications in package.json
  - **Cursor-Specific Detection Required**: While the extension API is the same, we need to detect Cursor's specific AI generation states, not generic VS Code behavior
  - **Version Compatibility**: Current Cursor builds are based on VS Code 1.93.1, so engine specification should target compatible versions
  - **Preloading is the Answer**: Games should load on extension startup and stay running in background, not on-demand. Show/hide is just CSS visibility control. No loading delays, no offline complexity, simple and fast.
  - **Internet Dependency is Fine**: Cursor requires internet for AI models anyway, so offline support is unnecessary complexity
  - **WebView Persistence**: retainContextWhenHidden keeps games running even when panels are hidden, perfect for instant show/hide
  - **Unity WebGL Incompatibility**: Unity WebGL games fundamentally cannot work in VS Code WebViews due to service worker requirements and security restrictions. This is a hard blocker, not a configuration issue.
  - **Panel Refactoring Success**: Successfully moved from editor panel to bottom panel using custom view container, providing better UX and proper integration with VS Code's panel system.
  - **Panel Visibility != Content Visibility**: VS Code API doesn't provide direct panel hide/show methods. Current implementation controls content visibility via CSS, not the actual panel frame.
  - **Bottom Panel Requires Different API**: True bottom panel (like Terminal) needs WebView View API, not WebView Panel API. This would be a significant refactoring.
  - **VS Code Extension Architecture**
    - Extensions run in separate Node.js process
    - WebViews are sandboxed iframes with limited capabilities
    - Can use VS Code's View API for panel integration
    - Extensions can spawn child processes without restrictions
  - **Unity WebGL Limitations**
    - Requires service workers (blocked in WebViews)
    - Large file sizes (30MB+) problematic for extensions
    - Security restrictions prevent proper loading
  - **Game Integration Approaches**
    - Simple HTML5/Canvas games work best in WebViews
    - External windows via Electron provide full flexibility
    - IPC communication enables extension-window coordination
  - **WebView Security Model**: VS Code WebViews have strict CSP and security restrictions that make Unity WebGL games incompatible. The sandboxed environment blocks service workers and certain WebAssembly features Unity requires.
  - **Panel Positioning**: VS Code's View API allows true bottom panel integration without the hacky editor approach. Views can be properly docked and managed by VS Code's layout system.
  - **External Window Approach**: Spawning an independent Electron window from the extension provides complete UI freedom - floating windows, transparency, custom positioning, and full game compatibility without WebView restrictions.
  - **Electron Process Management**: VS Code extensions can spawn child processes without restrictions. Using Electron as a child process provides a full browser environment for games while maintaining IPC communication with the extension.
  - **IPC Design**: JSON-RPC over stdin/stdout provides simple, reliable communication between extension and Electron window. No need for complex protocols - just line-delimited JSON messages.
  - **Window Positioning**: Electron's screen API allows precise window positioning. Bottom-left corner placement keeps games visible but unobtrusive during AI generation.
  - **Electron Module Loading Issue**: When spawning Electron as a child process from Node.js, `require('electron')` returns the executable path instead of API modules. This is because the electron npm package only exports the path, and Electron modules are only available within the Electron runtime. Solution: Use `stdio: 'inherit'` like the official wrapper, and implement file-based IPC when standard streams aren't available.
  - **No Official Cursor API**: As of 2024, Cursor hasn't exposed APIs for detecting AI generation events, forcing creative workarounds
  - **Shadow Workspace Feature**: Cursor uses hidden windows for AI to test code without affecting user experience - potential detection point
  - **Community Demand**: Multiple developers requesting AI detection APIs, indicating this is a common need
- Spiky POVs
  - Most "productivity" tools try to eliminate distractions, but strategic distraction within the IDE is actually better than uncontrolled context switching
  - The future of AI coding isn't faster generation, it's better utilization of generation time
  - Gamification of waiting could become a standard IDE feature, not just an extension
  - This could evolve into a platform for indie game developers to reach programmer audiences
  - The data on "productive waiting time" could reveal insights about AI coding patterns and optimal work sessions
  - **Abandon Unity WebGL**: For VS Code extensions, Unity WebGL is overkill. Simple HTML5/Canvas games provide better user experience with instant loading and no compatibility issues.
  - **Floating Windows > Panels**: The constrained panel approach limits the playful nature of distraction games. Floating windows that can be positioned anywhere create a more engaging, less intrusive experience.
  - **Distribution Strategy**: Instead of bundling games with the extension, consider a game marketplace/loader approach where users can download games on-demand to reduce extension size.
- Other Brainlifts
  - [To be added as project evolves]

## Technical Discoveries

### itch.io Game Extraction
- **iframe Detection**: itch.io embeds games in iframe elements with specific URL patterns
- **Asset Parsing**: Unity WebGL games have predictable asset structure (.loader.js, .framework.js.gz, .data.gz, .wasm.gz)
- **URL Encoding**: Build directory often contains URL-encoded filenames that need decoding
- **Dependency Removal**: itch.io scripts can be safely removed for standalone operation
- **BeautifulSoup Parsing**: Python script can reliably extract embedded game URLs and download assets

### Unity WebGL Architecture
- **Self-Contained**: Once downloaded, games are completely self-contained
- **CORS Headers**: Local test server needs specific headers for proper WebAssembly loading
- **File Structure**: Predictable build output makes automation possible
- **Resource Loading**: All assets load via relative paths, making local hosting straightforward
- **WebView Incompatibility**: Unity's requirement for service workers and complex asset loading patterns conflict with VS Code WebView's security model
- **File Size Issues**: 34MB+ Unity builds may be too large for extension distribution
- **Alternative Needed**: Must pivot to lightweight HTML5/Canvas games that work within WebView constraints

### WebView Architecture
- Nested iframe structure provides best control
- Service workers can implement virtual endpoints for resource loading
- CSP inheritance can be problematic for inline content
- **Panel Types**: WebView Panel API creates editor tabs, WebView View API creates sidebar/bottom panels
- **Visibility Control**: No direct API to hide panel frame - only content visibility or focus switching
- **State Persistence**: `retainContextWhenHidden: true` maintains WebView state when panel is backgrounded

### Panel Management Discoveries
- **No Direct Hide Method**: VS Code API lacks panel.hide() - must use workarounds
- **Editor Panels**: Created with `createWebviewPanel`, appear as tabs in editor area
- **Bottom Panels**: Require `registerWebviewViewProvider` and manifest changes
- **Visibility Options**: 
  - Dispose/recreate (loses state)
  - Focus switching (panel remains in tab bar)
  - Minimize panel area (for bottom panels only)
- **Best Practice**: Use `retainContextWhenHidden` and control content visibility, not panel visibility

### Performance Optimizations
- Lazy load game resources
- Dispose WebViews when not needed
- Limit concurrent WebView instances
- Use local resources whenever possible

## Brainlift Update

### Knowledge Tree

#### Technical Findings

##### **AI Detection System Architecture** 
- Document Change Analysis is the only fully working detection method 
- VS Code extension API security restrictions prevent 75% of planned detection approaches
- Extensions cannot access main UI DOM, intercept commands, or read other extensions' status bars
- Success depends on enhancing the one working method rather than pursuing impossible approaches

##### **Extension Development Discovery**
- vsce builds VS Code extensions for Cursor compatibility
- Cursor CLI: `/usr/local/bin/cursor --install-extension` for local development 
- Hot reloading requires manual reinstall cycle during development
- Build chain: TypeScript compilation → vsce package → cursor install

##### **Detection Method Implementation Status** 
- ✅ Document Change Analysis: Working (95% confidence detection)
- ❌ DOM Monitoring: Fundamentally impossible (extension security sandbox)
- ❌ Command Interception: Not supported by VS Code API
- ❌ Status Bar Monitoring: Extension isolation prevents access
- ✅ **Selection Change Monitoring: NEWLY IMPLEMENTED** (tracks AI-generated selection patterns)
- ✅ **Language Server Protocol Monitoring: NEWLY IMPLEMENTED** (monitors completion/hover/code action events)
- ✅ **File System Monitoring: NEWLY IMPLEMENTED** (watches Cursor-specific directories for AI activity)

#### **Extension Crash Investigation & Fixes** ⚠️ **CRITICAL LEARNING**
**Problem**: Initial implementation of new detection methods caused Cursor to crash completely
**Root Causes Identified**:
1. **File System Monitoring**: Using `require('os')` and `require('path')` in extension context
2. **Incorrect RelativePattern Usage**: Passing absolute paths instead of workspace folders
3. **Language Server Provider Issues**: Returning `undefined` from providers confuses VS Code
4. **Performance Issues**: Too many file watchers and event handlers firing simultaneously

**Fixes Applied**:
- **DISABLED File System Monitoring entirely** (marked as inactive in dashboard)
- **Simplified LSP Monitoring**: Only completion provider, returns empty arrays, added error handling
- **Reduced Event Frequency**: Added random sampling to prevent spam (2% chance vs 10%)
- **Added Safety Checks**: Try-catch blocks around all event handlers
- **Limited Scope**: Only monitor specific file types and reasonable selection sizes

**Key Insight**: Extension development requires extreme caution - a single poorly implemented method can crash the entire editor

#### **Live Testing Phase Initiated** ⚡ **CURRENT STATUS**
**Milestone**: Completed crash-safe implementation of 3 viable detection methods
**Ready for Testing**: 
- Document Change Analysis (primary method, highest confidence)
- Selection Change Monitoring (secondary method, pattern-based)
- Language Server Protocol Monitoring (tertiary method, event-based)

**Disabled Methods** (4 total):
- DOM Monitoring: Webview approach caused immediate crashes
- Command Interception: Confirmed impossible via VS Code API
- Status Bar Monitoring: Extension isolation prevents cross-extension access
- File System Monitoring: Node.js require() usage and performance issues

**Testing Objective**: Determine which methods actually trigger during real Cursor AI usage and validate their accuracy, reliability, and false positive rates.

#### **Live Testing Results & Architectural Discoveries** 📊 **BREAKTHROUGH INSIGHTS**
**Test Results**: Only Document Change Analysis fires during real AI usage

**Root Cause Analysis**:
- **Selection Change Monitoring**: Implementation issues (fixable)
  - Threshold too high (0.5), sampling too low (30%)
  - Wrong assumptions about AI selection patterns
  - Needs better pattern detection for smaller, rapid changes

- **Language Server Protocol Monitoring**: Fundamental architectural limitation (unviable)
  - **Critical Discovery**: Cursor AI bypasses standard VS Code LSP completion system entirely
  - Cursor AI operates as direct text replacement, not through `vscode.languages.*` APIs
  - Standard LSP events are user-triggered, not AI-triggered
  - Our LSP monitoring approach was fundamentally flawed from the start

**Architectural Insight**: Cursor's AI is more like a sophisticated text replacement engine than a traditional IDE completion system. It doesn't integrate with VS Code's standard completion providers, hover systems, or diagnostic tools.

#### **Final Detection Method Classification** 🎯 **DEFINITIVE STATUS**
- **✅ Working (1/7)**: Document Change Analysis (proven reliable)
- **🔧 Fixable (1/7)**: Selection Change Monitoring (implementation issues)  
- **❌ Fundamentally Unviable (5/7)**: 
  - DOM Monitoring (webview crashes)
  - Command Interception (API limitation)
  - Status Bar Monitoring (extension isolation)  
  - File System Monitoring (performance issues)
  - **Language Server Protocol Monitoring** (Cursor AI bypasses standard LSP)

**Strategic Implication**: Focus on enhancing Document Change Analysis as primary method, with Selection Change as secondary after fixes.

#### Insights

##### **"One Working Method" Philosophy**
Instead of building complex multi-method detection systems, focus on making the working Document Change Analysis incredibly robust and accurate.

##### **Extension API Reality Check**
VS Code's security model is intentionally restrictive. Extensions operate in isolated contexts that prevent most advanced monitoring approaches we initially planned.

##### **Detection Confidence Tuning**
Our detection system now has multiple viable methods feeding into a confidence score:
- Document changes (working since day 1)
- Selection patterns (new - detects AI-characteristic large/rapid selections)
- Language server events (new - correlates with AI completion requests)
- File system changes (new - monitors Cursor data directories)

##### **Development Velocity vs. Research Quality**
Deep research into VS Code API limitations saved weeks of implementation effort on impossible approaches. Time spent on research docs paid off.

#### Spiky POVs

##### **Security Restrictions Are Actually Good**
VS Code's extension isolation isn't a limitation - it's a feature. It prevents malicious extensions from accessing sensitive data. Our detection system works within these constraints elegantly.

##### **Multi-Method Redundancy Strategy**
Even though Document Change Analysis works well, having 3+ detection methods provides:
- Backup if Cursor updates break one method
- Cross-validation of AI activity
- Different confidence levels for different AI operation types
- Reduced false positives through pattern correlation

##### **Platform-Specific Detection Opportunities**
File system monitoring opens platform-specific detection paths:
- macOS: `~/Library/Application Support/Cursor`
- Windows: `%APPDATA%/Cursor`
- Linux: `~/.config/Cursor`

Each platform might have unique AI activity signatures in these directories.

#### Experts

##### Resources
- **VS Code Extension API Documentation**: https://code.visualstudio.com/api
  - Critical for understanding security restrictions and available APIs
- **GitHub Issues for Command Interception**: Referenced issue #44771 marked "out-of-scope"
  - Confirms that command wrapping/interception is intentionally not supported

##### Communities  
- **VS Code Extension Development Discord/Reddit**: For advanced API questions
- **Cursor Community Forums**: For Cursor-specific extension behavior patterns