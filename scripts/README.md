# Ritalin Game Grabber Scripts

These scripts automatically download Unity WebGL games from itch.io and prepare them for local hosting in the Ritalin extension.

## Available Scripts

### `grab_itch_game.py` (Recommended)
Python version with robust HTML parsing and better error handling.

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

### `grab_itch_game.sh`
Bash version for Unix-like systems (macOS, Linux).

**Usage:**
```bash
./scripts/grab_itch_game.sh <itch_game_url> [game_name]
```

## What the Scripts Do

1. **Download Detection**: Automatically finds the download link on the itch.io game page
2. **File Extraction**: Downloads and extracts the game files (handles zip archives)
3. **Filename Fixing**: Converts URL-encoded filenames to proper names
4. **Standalone Creation**: Removes itch.io dependencies to create a truly standalone version
5. **Extension-Ready Files**: Creates optimized files for VS Code extension integration

## Output Structure

Each game is organized in `games/<game_name>/` with:

```
games/die-in-the-dungeon/
├── index.html              # Original game HTML
├── standalone.html         # Clean version without itch.io deps
├── launcher.html          # Extension-optimized wrapper
├── game_info.json         # Metadata about the game
├── test_server.py         # Local testing server
└── Build/                 # Unity WebGL build files
    ├── Die in the Dungeon 1.6.2f [WEB].data.gz
    ├── Die in the Dungeon 1.6.2f [WEB].framework.js.gz
    ├── Die in the Dungeon 1.6.2f [WEB].loader.js
    └── Die in the Dungeon 1.6.2f [WEB].wasm.gz
```

## Testing Downloaded Games

Each game comes with a test server:

```bash
cd games/<game_name>
python3 test_server.py
```

This opens the game in your browser at `http://localhost:8080/launcher.html`

## Integration with VS Code Extension

Use the `launcher.html` file in your VS Code extension WebView:

```typescript
const gameUri = vscode.Uri.file(path.join(gamesDir, gameName, 'launcher.html'));
webviewPanel.webview.html = fs.readFileSync(gameUri.fsPath, 'utf8');
```

## Supported Games

The scripts work with:
- ✅ Unity WebGL games on itch.io
- ✅ Free games with public download links
- ✅ Games distributed as zip archives
- ✅ Games with standard itch.io hosting

**Note:** The game must be freely available for download. The scripts cannot bypass payment or access restrictions.

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