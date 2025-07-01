# Release Notes - v0.2.0

## What's New

- **Pause/Unpause Functionality**: Added the ability to temporarily disable AI detection
  - New status bar item showing "Ritalin: Active" or "Ritalin: Paused"
  - Click the status bar or use command "Ritalin: Pause/Unpause Extension"
  - Visual feedback with warning background when paused
  - Automatically sets AI working status to false when paused
  - Updates AI activity rule to disable when paused

## Bug Fixes

- Improved AI detection state management across pause/unpause cycles
- Better synchronization between extension state and AI rule configuration

## Known Issues

- None reported in this release

## Installation

### From VS Code Marketplace

1. Open Cursor
2. Go to Extensions (Cmd+Shift+X)
3. Search for "Ritalin"
4. Click Install

### Manual Installation

1. Download the `.vsix` file from the [releases page](https://github.com/ritalin-dev/ritalin/releases)
2. In Cursor, open the command palette (Cmd+Shift+P)
3. Run "Extensions: Install from VSIX..."
4. Select the downloaded file

## Feedback

Please report any issues on our [GitHub repository](https://github.com/ritalin-dev/ritalin/issues).
