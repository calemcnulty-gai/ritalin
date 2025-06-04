# Ritalin Game Grabber Script

This script automatically downloads Unity WebGL games from itch.io and prepares them for local hosting in the Ritalin extension.

## Script

### `grab_itch_game.py`
Python script with robust HTML parsing and simplified Unity file handling.

**Requirements:**
```bash
pip install beautifulsoup4
```

**Usage:**
```bash
python3 scripts/grab_itch_game.py <itch_game_url> [game_name]
```

**Example:**
```bash
python3 scripts/grab_itch_game.py https://game-dev.itch.io/die-in-the-dungeon die-in-the-dungeon
```

## What the Script Does

1. **Download Detection**: Automatically finds the download link on the itch.io game page
2. **File Extraction**: Downloads and extracts the game files (handles zip archives)
3. **Filename Fixing**: Converts URL-encoded filenames to proper names
4. **Simplified Files**: Creates simplified Unity filenames (loader.js, framework.js, data, wasm) for better WebView compatibility
5. **Standalone Creation**: Removes itch.io dependencies and updates references to use simplified filenames
6. **Extension-Ready Files**: Creates optimized files for VS Code extension integration

## Output Structure

Each game is organized in `games/<game_name>/` with:

```
games/die-in-the-dungeon/
├── index.html              # Original game HTML
├── standalone.html         # Clean version without itch.io deps + simplified file refs
├── launcher.html          # Extension-optimized wrapper
├── game_info.json         # Metadata about the game
├── test_server.py         # Local testing server
└── Build/                 # Unity WebGL build files
    ├── Die in the Dungeon 1.6.2f [WEB].data.gz    # Original files
    ├── Die in the Dungeon 1.6.2f [WEB].framework.js.gz
    ├── Die in the Dungeon 1.6.2f [WEB].loader.js
    ├── Die in the Dungeon 1.6.2f [WEB].wasm.gz
    ├── data.gz             # Simplified copies for WebView
    ├── framework.js.gz
    ├── loader.js
    └── wasm.gz
```

## Testing Downloaded Games

Each game comes with a test server:

```bash
cd games/<game_name>
python3 test_server.py
```

This opens the game in your browser at `http://localhost:8080/launcher.html`

## Integration with VS Code Extension

The extension automatically uses the `standalone.html` file which references simplified Unity filenames that work reliably in WebViews.

## Supported Games

The script works with:
- ✅ Unity WebGL games on itch.io
- ✅ Free games with public download links
- ✅ Games distributed as zip archives
- ✅ Games with standard itch.io hosting

**Note:** The game must be freely available for download. The script cannot bypass payment or access restrictions.

## Troubleshooting

### "Could not find download link"
- Game might not be free
- Game might require itch.io account login
- Try downloading manually and extracting to `games/` directory

### "No HTML file found"
- Downloaded file might not be a Unity WebGL game
- Check the game's description for supported platforms

### Game doesn't load properly
- Check browser console for errors
- Verify all Build files are present and properly named
- Try the original `index.html` vs `standalone.html`

## Legal Notes

- Only download games you have the right to use
- Respect the game developer's licensing terms
- These scripts are for legitimate use cases only
- Support game developers by visiting their itch.io pages 