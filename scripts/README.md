# Ritalin Game Grabber Script

This script automatically downloads Unity WebGL games, PICO-8 games, and other HTML5 games from itch.io and prepares them for local hosting in the Ritalin extension.

## Script

### `grab_itch_game.py`
Enhanced Python script with robust HTML parsing, multi-engine support, and both embedded game and downloadable ZIP file handling.

**Requirements:**
```bash
pip install beautifulsoup4 requests
```

**Usage:**
```bash
python3 scripts/grab_itch_game.py <itch_game_url> <game_name> <output_dir> [engine_type]
```

**Example:**
```bash
python3 scripts/grab_itch_game.py https://alarts.itch.io/die-in-the-dungeon die-in-the-dungeon ./games unity
```

## What the Script Does

1. **Game Metadata Loading**: Automatically loads game metadata from `curated_games.json` for enhanced processing
2. **Multi-Source Download**: Attempts embedded game download first, falls back to ZIP file downloads
3. **Engine Detection**: Automatically detects game engines (Unity WebGL, PICO-8, Construct, GameMaker, Godot, Phaser)
4. **Asset Discovery**: Finds and downloads all required game assets with improved parsing
5. **Progress Tracking**: Shows download progress for large files
6. **Standalone Creation**: Removes itch.io dependencies and creates clean standalone versions
7. **Extension Integration**: Creates optimized files for VS Code extension integration

## Supported Game Types

### Browser-Playable Games (Embedded)
- ✅ Unity WebGL games with proper config parsing
- ✅ PICO-8 games with JavaScript asset detection
- ✅ Construct 2/3 games
- ✅ GameMaker Studio games
- ✅ Godot HTML5 exports
- ✅ Phaser.js games
- ✅ Generic HTML5 games

### Downloadable Games (ZIP Files)
- ✅ Unity standalone builds
- ✅ Game Boy ROM files
- ✅ Any ZIP-distributed HTML5 games
- ✅ Executable games (for reference)

## Output Structure

Each game is organized in `games/<game_name>/` with:

```
games/die-in-the-dungeon/
├── index.html              # Original game HTML
├── standalone.html         # Clean version without itch.io deps
├── launcher.html          # Extension-optimized wrapper
├── game_info.json         # Metadata about the game
└── Build/                 # Unity WebGL build files (or other engine assets)
    ├── [GameName].loader.js
    ├── [GameName].data.gz
    ├── [GameName].framework.js.gz
    └── [GameName].wasm.gz
```

## Game Metadata Integration

The script integrates with `curated_games.json` to:
- Use pre-configured iframe URLs for faster downloads
- Apply correct engine hints automatically
- Handle game-specific download requirements
- Provide enhanced metadata for the extension

## Testing Downloaded Games

Each game comes with a launcher that can be tested directly in a browser or used within the VS Code extension.

## Integration with VS Code Extension

The extension automatically uses the `launcher.html` file which provides optimal compatibility with WebViews and handles all necessary game loading.

## Troubleshooting

### "Failed to download embedded game"
- Script will automatically fall back to ZIP download
- Check if the game requires login or payment

### "No download links found"
- Game might not be freely available
- Game might be browser-only with no downloadable version

### Game doesn't load properly
- Check browser console for errors in `standalone.html`
- Verify all required assets were downloaded
- Try the original `index.html` vs `standalone.html`

### Progress shows >100%
- This is normal for compressed files where Content-Length doesn't match actual file size
- Download is still working correctly

## Engine-Specific Notes

### Unity WebGL
- Automatically parses Unity configuration objects
- Downloads all Build/ and TemplateData/ assets
- Handles both compressed (.gz) and uncompressed assets

### PICO-8
- Downloads main JavaScript executable
- Preserves original PICO-8 runtime
- Supports both classic and modern PICO-8 exports

### Generic HTML5
- Downloads all linked resources (JS, CSS, images, audio)
- Preserves original game structure
- Compatible with most HTML5 game engines

## Legal Notes

- Only download games you have the right to use
- Respect the game developer's licensing terms
- These scripts are for legitimate use cases only
- Support game developers by visiting their itch.io pages 