# Ritalin for Cursor

A VS Code extension that displays mini-games during Cursor AI generation to help maintain developer focus.

## Features

- **AI Detection**: Automatically detects when Cursor AI is generating code
- **Game Display**: Shows itch.io games in a resizable webview panel
- **Configurable**: Adjustable delay, game URL, and window dimensions
- **Keyboard Shortcuts**: Quick toggle with Ctrl+Shift+G (Cmd+Shift+G on Mac)

## Development Setup

### Prerequisites

- Node.js (v16 or later)
- npm or yarn
- VS Code

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/calemcnulty-gai/ritalin.git
   cd ritalin
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Compile the extension:
   ```bash
   npm run compile
   ```

### Running the Extension

1. Open the project in VS Code
2. Press `F5` to launch a new Extension Development Host window
3. The extension will be active in the new window

### Available Commands

- `Ritalin: Show Game` - Display the game panel
- `Ritalin: Hide Game` - Hide the game panel  
- `Ritalin: Toggle Game` - Toggle game panel visibility

### Configuration

Access settings via `Preferences: Open Settings` and search for "Ritalin":

- `ritalin.gameUrl`: URL of the game to display (default: Die in the Dungeon)
- `ritalin.showDelay`: Delay in milliseconds before showing game (default: 2000)
- `ritalin.enabled`: Enable/disable the extension (default: true)
- `ritalin.windowWidth`: Default game window width (default: 800)
- `ritalin.windowHeight`: Default game window height (default: 600)

## Architecture

- `src/extension.ts` - Main extension entry point
- `src/gamePanel.ts` - WebView panel management for game display
- `src/cursorDetector.ts` - AI generation detection logic (TODO)

## Known Limitations

- AI detection is not yet implemented (placeholder in cursorDetector.ts)
- Currently requires manual command execution to show games
- CORS limitations may affect some games

## Contributing

See the main project README for development guidelines and project structure.

## License

MIT 