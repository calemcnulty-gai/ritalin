# Ritalin for Cursor - Project Plan

## Overview
Building a VS Code extension that displays mini-games during Cursor AI generation to maintain developer focus.

## Task List

### Phase 1: Core Extension Infrastructure

#### Task 1: Project Setup
- [x] Initialize npm project with proper dependencies
- [x] Set up TypeScript configuration for VS Code extension development
- [x] Create basic directory structure

#### Task 2: VS Code Extension Boilerplate
- [x] Create package.json with proper VS Code extension metadata
- [x] Implement basic extension.ts with activation/deactivation
- [x] Set up command registration for show/hide/toggle game panel
- [x] Configure extension manifest and activation events

#### Task 3: Game Panel WebView Implementation
- [x] Create GamePanel class with WebView integration
- [x] Implement show/hide/toggle functionality
- [x] Set up proper resource loading configuration
- [x] Add debugging and error handling

#### Task 4: Cursor AI Detection Framework
- [x] Create CursorDetector class with event system
- [x] Implement placeholder detection methods
- [x] Set up event handlers for AI generation start/end
- [x] Configure auto-show/hide based on AI detection

#### Task 5: Game Integration
- [x] Download and extract Unity WebGL game from itch.io
- [x] Implement Unity WebGL loading in WebView
- [x] Add comprehensive debugging and error handling
- [x] **DONE**: Unity WebGL incompatible with Cursor WebView security model

#### Task 6: Testing and Debugging
- [x] Set up extension packaging with vsce
- [x] Create comprehensive debug logging system
- [x] Test extension installation and basic functionality
- [x] Implement error reporting and retry mechanisms

### Phase 2: Game Loading Solutions

#### Task 7: Alternative Game Integration
**Priority: HIGH** - Current Unity approach blocked by WebView security
Options to explore:
- [x] Simple HTML5/Canvas games (Snake, Tetris, etc.)
- [x] Lightweight JavaScript puzzle games
- [x] Custom mini-games built specifically for WebView environment
- [x] Pre-compiled WebAssembly games with minimal dependencies

#### Task 8: External Game Window Implementation
**Priority: HIGH** - Implement floating external window for games
- [x] **DONE** - Research external window approach using Electron
- [x] **DONE** - Create Electron app structure for game window
- [x] **DONE** - Implement IPC communication between extension and window
- [x] **DONE** - Create GameWindowManager class for process management
- [x] **DONE** - Add test command for external window
- [x] **DONE** - Test external window with Cursor AI detection
- [x] **DONE** - Implement game loading from downloaded itch.io games
- [x] **DONE** - Fix WebGL context issues for Unity games
- [x] **DONE** - Add window positioning and size preferences
- [x] **DONE** - Handle multi-monitor support
- [x] **DONE** - Create configuration UI for external window settings

#### Task 9: Game State Management
- [x] Implement game state persistence between sessions
- [x] Add game selection/rotation system
- [x] Create user preferences for game types
- [x] Track gaming time and productivity metrics

#### Task 10: Cursor AI Detection Implementation
**Status: DONE** - feature/task-10-cursor-ai-detection
- [x] Research Cursor-specific DOM patterns and API calls
- [x] Research VS Code extension API limitations and security model
- [x] Implement multi-method AI detection framework with 4 active detection methods:
  - [x] **AI Self-Reporting** (Tier 1 - 99%/1% confidence) - AI edits .cursor/is_working file
  - [x] **Document Change Analysis** (50-95% confidence) - Detects rapid text changes
  - [x] **Selection Change Monitoring** (50% confidence) - Monitors cursor/selection patterns
  - [x] **Chat/Focus Change Detection** (15-40% confidence) - Detects editor focus changes
- [x] Disable fundamentally unviable methods:
  - [x] ~~DOM Monitoring~~ - DISABLED (webview crashes)
  - [x] ~~Command Interception~~ - DISABLED (API limitation)
  - [x] ~~Status Bar Monitoring~~ - DISABLED (extension isolation)
  - [x] ~~File System Monitoring~~ - DISABLED (performance/crash issues)
  - [x] ~~Language Server Protocol Monitoring~~ - DISABLED (Cursor AI bypasses standard LSP)
- [x] Implement AI self-reporting system with .cursor/is_working file and Cursor rule
- [x] Add 60-second timeout safety mechanism for AI detection
- [x] Create comprehensive output channel logging for debugging
- [x] Remove dashboard in favor of direct game window show/hide
- [x] Clean up test code and unused detection methods
- [x] Remove StatusBarManager and simplify extension architecture
- [x] Package size optimization (6MB+ → 2.59MB via .vscodeignore)
- [x] **Auto-initialization for new projects** - Extension creates required .cursor files
- [x] **Filename correction** - Fixed all references from .cursor/.is_working → .cursor/is_working
- [x] **COMPLETED: Production-ready AI detection with automatic game show/hide**

#### Live Testing Results Summary
- **✅ AI Self-Reporting**: PRIMARY detection method (99%/1% confidence)
  - Extension auto-creates .cursor/is_working file in new projects
  - File watcher monitors for AI activity state changes
  - 60-second timeout safety mechanism prevents stuck states
- **✅ Document Change Analysis**: SECONDARY detection method (50-95% confidence)
  - Detects large, rapid text changes characteristic of AI generation
  - Working as backup detection for non-compliant AI interactions
- **🔧 Selection & Chat Detection**: AUXILIARY methods (15-50% confidence)
  - Provide additional signals but not primary detection
  - Used for confidence scoring and edge case handling

#### Task 11: Performance Optimization
- [ ] Optimize WebView resource loading
- [ ] Implement lazy loading for game assets  
- [ ] Add memory management for game instances
- [ ] Test extension impact on Cursor performance

### Phase 3: Polish and Distribution

#### Task 11.5: Prune Deprecated Game Panel Code
**Status: DONE**
- **Objective**: Remove all code related to the deprecated WebView panel to streamline the codebase.
- **Action Items**:
  - [x] **Delete `src/gamePanelView.ts`**: This file contains the `GamePanelViewProvider`, which is no longer needed.
  - [x] **Refactor `src/extension.ts`**: 
    - [x] Remove the import for `GamePanelViewProvider`.
    - [x] Remove the instantiation and registration of `GamePanelViewProvider`.
    - [x] Remove any commands specifically related to toggling the panel view (e.g., `ritalin.toggleGame`).
  - [x] **Update `package.json`**:
    - [x] Remove the `ritalin.toggleGame` command from `contributes.commands`.
    - [x] Remove the `ritalin` view container from `contributes.viewsContainers`.
    - [x] Remove the `ritalin.gameView` from `contributes.views`.
    - [x] Remove the `ritalin.showResizeTip` configuration from `contributes.configuration`.

#### Task 12: Post-Install & Configuration Experience
**Status: Done** ✅
- **Objective**: Create a seamless and intuitive post-install and configuration experience.
- **Action Items**:
  - [x] On first install, automatically open a custom configuration page in a new editor tab.
  - [x] Design and implement the configuration page as a webview.
  - [x] The configuration page should provide a clear "getting started" guide.
  - [x] Display curated popular turn-based games from itch.io with real thumbnails.
  - [x] Implement a game search bar directly on the configuration page.
  - [x] The game search should have live typeahead functionality, showing results as the user types.
  - [x] Add smart button states: Download → Select → ✓ Selected
  - [x] Fix game download functionality with proper Python script integration
  - [x] Package real game images from itch.io in the extension
  - [x] Add proper configuration registration for selectedGame setting
  - [x] Implement game selection functionality with UI feedback

#### Task 12.5: Game Download System Consolidation
**Status: DONE** ✅
- **Objective**: Consolidate duplicate game download functionality and fix download failures
- **Action Items**:
  - [x] **Consolidate JSON Files**: Merge curated_games_enhanced.json, curated_games_updated.json into single curated_games.json
  - [x] **Consolidate Python Scripts**: Merge enhanced_game_fetcher.py and update_curated_games.py functionality into grab_itch_game.py
  - [x] **Fix Download Issues**: Rewrite grab_itch_game.py to handle both embedded games and downloadable ZIP files
  - [x] **Add Multi-Engine Support**: Enhance script to properly detect and download Unity WebGL, PICO-8, and other game engines
  - [x] **Improve Asset Discovery**: Better parsing of Unity config objects and game asset detection
  - [x] **Add Progress Tracking**: Implement download progress indicators for large files
  - [x] **Add Metadata Integration**: Use curated_games.json metadata for enhanced download processing
  - [x] **Test Download Fixes**: Verify that previously failing games (Die in the Dungeon, Average Routine, etc.) now download successfully
  - [x] **Update Documentation**: Revise scripts/README.md to reflect consolidated functionality

#### Task 13: Extension Distribution
**Status: In Progress** 🔄
- [x] Research Cursor extension distribution and marketplace options
  - [x] **Investigation Complete**: Created comprehensive `docs/extension_distribution.md` with findings:
    - [x] Cursor uses VS Code marketplace but Microsoft enforcing stricter ToS
    - [x] Open VSX Registry available as alternative marketplace
    - [x] Direct .vsix distribution essential for beta testing
    - [x] Multi-channel distribution strategy recommended
    - [x] Cursor 1.0 released June 2025, growing user base
  - [x] **Distribution Strategy Defined**: 
    - [x] **Primary**: VS Code Marketplace (while available)
    - [x] **Secondary**: Open VSX Registry (backup channel)
    - [x] **Essential**: GitHub Releases with .vsix files
    - [x] **Beta**: Direct distribution via GitHub pre-releases
  - [x] **Publishing Requirements Documented**:
    - [x] GitHub Actions workflow for automated packaging
    - [x] Multi-platform release automation
    - [x] Beta vs stable release separation
    - [x] Update notification system for direct installs
- [ ] Create installation and setup documentation
  - [ ] Write step-by-step installation guide
  - [ ] Document system requirements (Python, Electron dependencies)
  - [ ] Create troubleshooting guide for common issues
  - [ ] Add platform-specific instructions (macOS code signing, Windows security)
- [ ] Set up automated builds and releases
  - [ ] Create GitHub Actions workflow for automated packaging
  - [ ] Set up automated testing in CI/CD pipeline
  - [ ] Configure automatic .vsix generation on tag/release
  - [ ] Add version bumping automation
- [ ] Plan user feedback and iteration cycle
  - [ ] Create GitHub issue templates for bug reports and feature requests
  - [ ] Set up telemetry/analytics for usage patterns (privacy-compliant)
  - [ ] Plan beta testing program with early adopters
  - [ ] Design feedback collection mechanism within extension

### Phase 4: Code Cleanup and Refactoring

#### Task 14: Code Cleanup
**Status: completed** ✅
- **Objective**: Refactor the codebase to remove redundant, obsolete, and unnecessarily complex code as identified in the [code cleanup report](docs/code_cleanup.md).
- **Action Items**:
  - [x] **Simplify `cursorDetector.ts`**: Rewrite the class to only use the file-watching mechanism and remove all other heuristic-based detection logic.
  - [x] **Simplify Electron IPC**: Remove the redundant `stdin` handler in `main.js` and investigate removing the `run-electron.js` wrapper.
  - [x] **Consolidate Game Lists**: Modify `search_games.py` to read from `curated_games.json` instead of using a hardcoded list.
  - [x] **Remove Unused Files**: Delete `electron-game-window/test-simple.js`.
  - [x] **Remove Debug/Obsolete Commands**: Clean up package.json and extension.ts to remove all debug and redundant commands as documented in `docs/development_command_cleanup.md`.
  - [x] **Fix Window Spawn Delay**: Remove the hardcoded 2-second delay in `GameWindowManager.start()` as documented in `docs/ai_detection_and_window_spawning.md`.
  - [x] **Fix Race Condition**: Add `isStarting` flag to prevent multiple window spawning as documented in `docs/ai_detection_and_window_spawning.md`.
  - [x] **Remove Debug Logging**: Clean up verbose console.log statements and debug code throughout the codebase.
  - [x] **Fix Python Script Issues**: Rewrite `grab_itch_game.py` to properly parse Unity config and handle multiple game engines as documented in `docs/game_download.md`.
  - [x] **Clean Up Unused Imports**: Remove unused imports and dead code across all TypeScript files.
  - [x] **Update .vscodeignore**: Ensure all unnecessary files are excluded from the extension package.

## Current Sprint Focus
**Sprint 5**: Production Testing & Final Polish (Task 12.5 → Task 13 transition)
- **PRIMARY OBJECTIVE**: Test consolidated game download system with real games
- **SECONDARY OBJECTIVE**: Validate all game engines download and load correctly
- **TERTIARY OBJECTIVE**: Begin Extension Distribution preparation (Task 13)

### Active Tasks
#### Task 13: Extension Distribution
**Branch**: feature/task-13-extension-distribution
- Creating comprehensive distribution strategy for Ritalin extension
- Setting up automated builds and release pipeline
- Preparing documentation for end users
- **ALPHA RELEASED**: v0.1.0-alpha.1 published to GitHub Releases!

## Recent Completions
- **✅ Task 15: Fix Chess Game Asset Downloading**: Enhanced downloader to handle ES6 modules and SVG assets
  - Fixed ES6 module imports (chess.js, htm.js) not being downloaded
  - Added pattern matching for dynamically-loaded SVG chess piece files
  - Implemented multiple naming convention support for chess pieces
  - Added AI Chess to curated games list and verified functionality
  - Disabled automatic dev tools opening in Electron window for better UX
- **✅ Game Download Consolidation (Task 12.5)**: Complete rewrite and consolidation of game download system
  - **Consolidated JSON Files**: Merged 3 duplicate JSON files into single enhanced curated_games.json
  - **Consolidated Python Scripts**: Merged enhanced_game_fetcher.py and update_curated_games.py into grab_itch_game.py
  - **Fixed Download Failures**: Previously failing games (Die in the Dungeon, Average Routine, etc.) now download successfully
  - **Multi-Engine Support**: Enhanced support for Unity WebGL, PICO-8, and generic HTML5 games
  - **Better Asset Discovery**: Improved Unity config parsing and asset detection
  - **Progress Tracking**: Added download progress indicators for large files
  - **Metadata Integration**: Script now uses curated_games.json for enhanced processing
  - **Tested & Verified**: Both Unity and PICO-8 games download and extract correctly
- **✅ Auto-file Creation**: Extension now creates .cursor/rules/ai-activity-reporting.mdc and .cursor/is_working in new projects
- **✅ Filename Fix**: Corrected all references from .cursor/.is_working → .cursor/is_working (removed dot prefix)
- **✅ Workspace Detection**: Added workspace change listener to re-initialize files when switching projects
- **🔧 CRITICAL FIX**: Connected AI detection events to game window management
  - **Issue**: AI detection was working but game window never appeared
  - **Root Cause**: Missing event listeners connecting CursorDetector.onAiGenerationStart/End to GameWindowManager.show/hide
  - **Solution**: Added proper event listeners in extension.ts activation and workspace change handlers
  - **Status**: ✅ Fixed and tested - game window now shows/hides properly on AI detection
- **📦 Packaged & Installed**: v0.1.0 ready for production testing with all critical fixes

## Notes
- Priority is on MVP functionality before adding advanced features
- Must test thoroughly with actual Cursor usage patterns
- Game download system is now robust and handles multiple game engines
- Consider beta testing with small group before public release 