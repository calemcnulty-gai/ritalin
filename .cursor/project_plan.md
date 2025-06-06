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
- [ ] Simple HTML5/Canvas games (Snake, Tetris, etc.)
- [ ] Lightweight JavaScript puzzle games
- [ ] Custom mini-games built specifically for WebView environment
- [ ] Pre-compiled WebAssembly games with minimal dependencies

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
- [ ] Implement game state persistence between sessions
- [ ] Add game selection/rotation system
- [ ] Create user preferences for game types
- [ ] Track gaming time and productivity metrics

#### Task 10: Cursor AI Detection Implementation
- [ ] Research Cursor-specific DOM patterns and API calls
- [ ] Implement reliable AI generation detection
- [ ] Test auto-show/hide functionality with real AI requests
- [ ] Fine-tune timing and thresholds

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

## Current Blockers

1. **Unity WebGL Compatibility**: Current approach fails due to Cursor WebView security restrictions
2. **Large Asset Loading**: 34MB+ game files may be too large for extension distribution
3. **Service Worker Issues**: Unity games require service workers which fail in WebView context

## Immediate Next Actions

1. **Pivot to Lightweight Games**: Abandon Unity WebGL, implement simple HTML5/Canvas games
2. **Create Game Library**: Build collection of small, WebView-compatible games
3. **Test Alternative Approaches**: Verify lighter games work in Cursor WebView environment

## Current Sprint Focus
**Sprint 1**: Foundation & Research (Tasks 1-5 from Phase 1)

## Notes
- Priority is on MVP functionality before adding advanced features
- Must test thoroughly with actual Cursor usage patterns
- Consider beta testing with small group before public release 