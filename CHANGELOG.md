# Change Log

All notable changes to the "Ritalin for Cursor" extension will be documented in this file.




## [0.2.0] - 2025-01-15

### Added
- Pause/unpause functionality with status bar indicator
  - New clickable status bar item showing extension state
  - Visual feedback with icon and color changes
  - Command "Ritalin: Pause/Unpause Extension" in command palette
  - Automatic synchronization with AI detection system

### Changed
- AI detection can now be temporarily disabled without uninstalling
- Status bar provides constant visibility of extension state

### Fixed
- AI detection state properly preserved across pause/unpause cycles
- AI activity rule properly disabled when extension is paused

## [0.1.2] - 2025-06-27

### Added
- Pause/Unpause command to temporarily disable AI detection
- Status bar indicator showing extension state (Active/Paused)
- Automatic update of ai-activity-reporting.mdc alwaysApply field when pausing

### Changed
- 

### Fixed
- 

## [0.1.1-alpha] - 2025-06-27 (Pre-release)

### Added
- 

### Changed
- 

### Fixed
- 

## [0.1.0-alpha.1] - 2025-01-14

### Added
- Initial alpha release
- Automatic AI detection for Cursor IDE
- External game window that appears during AI code generation
- Integration with itch.io games
- Configuration UI for game selection and downloads
- Support for multiple game engines (Unity WebGL, PICO-8, HTML5)
- Auto-initialization of required workspace files
- Game state persistence between sessions

### Known Issues
- Game window positioning may need adjustment on multi-monitor setups
- Some itch.io games may fail to download
- Performance impact on lower-end machines
- Electron window may occasionally fail to spawn

### Notes
- This is an alpha release - expect bugs and incomplete features
- Designed specifically for Cursor IDE
- Report issues at: https://github.com/ritalin-dev/ritalin/issues 