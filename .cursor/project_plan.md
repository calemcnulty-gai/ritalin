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
  - [x] **AI Self-Reporting** (Tier 1 - 99%/1% confidence) - AI edits .cursor/.is_working file
  - [x] **Document Change Analysis** (50-95% confidence) - Detects rapid text changes
  - [x] **Selection Change Monitoring** (50% confidence) - Monitors cursor/selection patterns
  - [x] **Chat/Focus Change Detection** (15-40% confidence) - Detects editor focus changes
- [x] Disable fundamentally unviable methods:
  - [x] ~~DOM Monitoring~~ - DISABLED (webview crashes)
  - [x] ~~Command Interception~~ - DISABLED (API limitation)
  - [x] ~~Status Bar Monitoring~~ - DISABLED (extension isolation)
  - [x] ~~File System Monitoring~~ - DISABLED (performance/crash issues)
  - [x] ~~Language Server Protocol Monitoring~~ - DISABLED (Cursor AI bypasses standard LSP)
- [x] Implement AI self-reporting system with .cursor/.is_working file and Cursor rule
- [x] Add 60-second timeout safety mechanism for AI detection
- [x] Create comprehensive output channel logging for debugging
- [x] Remove dashboard in favor of direct game window show/hide
- [x] Clean up test code and unused detection methods
- [x] Remove StatusBarManager and simplify extension architecture
- [x] Package size optimization (6MB+ → 2.59MB via .vscodeignore)
- [x] **COMPLETED: Production-ready AI detection with automatic game show/hide**

#### Live Testing Results Summary
- **✅ Document Change Analysis**: WORKING (only method that fires)
- **🔧 Selection Change Monitoring**: Not firing due to implementation issues
  - Threshold too high (0.5), sampling too low (30%)
  - Wrong selection pattern assumptions
  - Needs fixes for smaller, rapid selection changes
- **❌ Language Server Protocol Monitoring**: Fundamentally unviable
  - Cursor AI bypasses standard VS Code completion providers
  - LSP events are user-triggered, not AI-triggered
  - Architectural mismatch - should be disabled like other unviable methods

#### Task 11: Performance Optimization
- [ ] Optimize WebView resource loading
- [ ] Implement lazy loading for game assets  
- [ ] Add memory management for game instances
- [ ] Test extension impact on Cursor performance

### Phase 3: Polish and Distribution

#### Task 12: User Experience Enhancements
- [ ] Add configuration options and settings UI
- [ ] Implement game selection interface
- [ ] Create onboarding and help documentation
- [ ] Add keyboard shortcuts and accessibility features

#### Task 13: Extension Distribution
- [ ] Prepare extension for Cursor marketplace (if available)
- [ ] Create installation and setup documentation
- [ ] Set up automated builds and releases
- [ ] Plan user feedback and iteration cycle

## Current Sprint Focus
**Sprint 3**: Detection Method Optimization & Game Integration (Task 10 completion + Task 11 start)
- **PRIMARY OBJECTIVE**: Fix Selection Change Monitoring implementation issues
- **SECONDARY OBJECTIVE**: Disable LSP Monitoring as fundamentally unviable
- **TERTIARY OBJECTIVE**: Enhance Document Change Analysis and integrate with game triggers

## Notes
- Priority is on MVP functionality before adding advanced features
- Must test thoroughly with actual Cursor usage patterns
- Consider beta testing with small group before public release 