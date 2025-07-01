# Ritalin for Cursor

Keep your focus sharp while AI generates code by playing mini-games instead of context-switching.

## Features

- **🤖 Automatic AI Detection**: Detects when Cursor AI is generating code and shows games automatically
- **🎮 External Game Window**: Floating game window that doesn't interfere with your coding
- **💾 Game State Persistence**: Pick up where you left off between coding sessions
- **🎯 8 Curated Games**: Hand-picked turn-based games perfect for micro-breaks
- **⏸️ Pause/Unpause**: Click the status bar to temporarily disable AI detection
- **⚙️ Fully Configurable**: Adjust window position, size, monitor, and game selection

## Quick Start

1. **Install the extension** in Cursor
2. **Open any project** - the extension will create necessary files automatically
3. **Use Cursor AI** - games will appear during generation
4. **Select a game** via `Cmd+Shift+P` → "Ritalin: Show Configuration Page"

## Available Games

### Bundled
- **Chess vs AI** - Play against Stockfish with adjustable difficulty

### Downloadable
- **Die in the Dungeon** - Dice-based roguelike
- **Folder Dungeon** - Dungeon crawler in computer folders
- **Slipways Classic** - Space strategy (PICO-8)
- **Shogun Showdown** - Turn-based combat roguelike
- **Backpack Hero** - Inventory management roguelike
- **Solitomb** - Solitaire dungeon crawler (PICO-8)
- **Porklike** - Classic roguelike (PICO-8)

## Commands

Access via Command Palette (`Cmd+Shift+P` on Mac, `Ctrl+Shift+P` on Windows/Linux):

- **Ritalin: Show Configuration Page** - Open game selection and download interface
- **Ritalin: Manage Downloaded Games** - Select or delete downloaded games
- **Ritalin: Pause/Unpause Extension** - Toggle AI detection on/off

## Configuration

Configure window behavior in VS Code settings:

```json
{
  "ritalin.externalWindow.position": "bottom-right",
  "ritalin.externalWindow.width": 800,
  "ritalin.externalWindow.height": 600,
  "ritalin.externalWindow.alwaysOnTop": true,
  "ritalin.externalWindow.monitor": "primary"
}
```

### Window Position Options
- `bottom-left`, `bottom-right` - Corner positions
- `top-left`, `top-right` - Top corners
- `center` - Center of screen
- `overlay` - Floating overlay
- `custom` - Use customX/customY coordinates

### Monitor Options
- `primary` - Main display
- `secondary` - External monitor
- `auto` - Monitor with most space

## How It Works

Ritalin uses a clever file-watching system where Cursor's AI reports its own status:

1. Extension creates `.cursor/is_working` file
2. AI updates file to `true` when generating
3. Game window appears instantly
4. AI updates file to `false` when done
5. Game window hides automatically

This provides near-instant detection with 99% accuracy!

## Requirements

- **Cursor IDE** (VS Code fork with AI features)
- **Node.js** - For Electron game window
- **Python 3** - For downloading games from itch.io
- **macOS/Windows/Linux** - Cross-platform support

## Troubleshooting

### Game window doesn't appear
- Check status bar shows "Ritalin: Active" (not paused)
- Verify a game is selected in configuration
- Check Output panel → "Ritalin" for errors

### Game download fails
- Ensure Python 3 is installed: `python3 --version`
- Check internet connection
- Some games are large (30-180MB)

### Extension issues
- Toggle pause/unpause via status bar
- Reload window: `Cmd+R` (Mac) or `Ctrl+R` (Windows/Linux)
- Check [GitHub Issues](https://github.com/ritalin-dev/ritalin/issues)

## Privacy

- No data collection or telemetry
- Games run locally in sandboxed window
- All settings stored locally
- No external API calls except game downloads

## Known Issues

- First-time Electron installation may take a moment
- Some itch.io games may have compatibility issues
- Window positioning needs refinement on multi-monitor setups

## Release Notes

### 0.2.0
- Added pause/unpause functionality with status bar indicator
- Improved AI detection state management
- Better error handling and logging

### 0.1.0
- Initial release with AI detection
- 8 curated games
- External game window
- Configuration UI

## Contributing

Found a bug or have a feature request? Please visit our [GitHub repository](https://github.com/ritalin-dev/ritalin).

## License

MIT License - see [LICENSE](https://github.com/ritalin-dev/ritalin/blob/main/LICENSE) for details.

---

**Enjoy staying focused with Ritalin!** 🎮✨ 