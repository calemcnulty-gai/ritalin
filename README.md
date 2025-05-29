# 🎮 Ritalin for Cursor

> Keep your focus sharp while AI generates code by playing mini-games instead of context-switching

## Overview

Ritalin for Cursor is a VS Code extension designed to solve a common problem: the 15-60 second wait times during AI code generation that lead developers to check social media, breaking their flow state. Instead of losing focus, play a quick round of "Die in the Dungeon" right in your editor!

## Features

- 🤖 **Automatic Detection** - Knows when Cursor AI is generating code
- 🎮 **Instant Gaming** - Mini-game appears within 500ms of generation start
- 💾 **State Persistence** - Pick up where you left off between coding sessions
- 🎯 **Focus Metrics** - Track your "productive waiting time"
- ⚙️ **Fully Configurable** - Adjust timing, position, and game preferences

## Installation

> ⚠️ **Note**: This extension is currently in development and not yet available on the VS Code marketplace.

### Development Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/ritalin-for-cursor.git
cd ritalin-for-cursor
```

2. Install dependencies:
```bash
npm install
```

3. Open in VS Code:
```bash
code .
```

4. Run the extension:
- Press `F5` to open a new VS Code window with the extension loaded
- Or run `npm run watch` for development mode

## Usage

1. **Install the extension** in your Cursor editor
2. **Start coding** with Cursor AI as normal
3. **When AI generates**, a game window automatically appears
4. **Play the game** while waiting for generation to complete
5. **Game auto-hides** when AI is done, returning focus to your code

### Commands

- `Ritalin: Toggle Game Window` - Manually show/hide the game
- `Ritalin: Settings` - Configure extension preferences
- `Ritalin: View Statistics` - See your focus metrics

### Configuration

Access settings through VS Code settings or the command palette:

```json
{
  "ritalin.enabled": true,
  "ritalin.gameDelay": 1000,        // ms before game appears
  "ritalin.windowPosition": "bottomRight",
  "ritalin.windowSize": {
    "width": 400,
    "height": 600
  },
  "ritalin.opacity": 0.9,
  "ritalin.soundEnabled": false
}
```

## Development

### Project Structure

```
ritalin-for-cursor/
├── src/
│   ├── extension.ts          # Main extension entry
│   ├── detectors/           # AI generation detection
│   ├── views/              # Game window management
│   ├── state/              # Game state persistence
│   └── config/             # User settings
├── resources/              # Static assets
├── .cursor/               # Project management
└── tests/                 # Test suites
```

### Building

```bash
# Development build with watch
npm run watch

# Production build
npm run build

# Run tests
npm test

# Package extension
npm run package
```

### Testing

1. Unit tests: `npm run test:unit`
2. Integration tests: `npm run test:integration`
3. Manual testing: Use F5 in VS Code to test in Extension Development Host

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Check the [Project Plan](.cursor/project_plan.md) for current tasks
2. Create a feature branch
3. Make your changes
4. Update tests and documentation
5. Submit a pull request

## Troubleshooting

### Game doesn't appear
- Check that Cursor AI is actually generating (not just thinking)
- Verify extension is enabled in settings
- Check console for error messages (Help > Toggle Developer Tools)

### Game won't load
- Ensure internet connection is active
- Check if itch.io is accessible
- Try increasing the game delay in settings

### Performance issues
- Reduce window size in settings
- Increase opacity for better GPU performance
- Disable animations in settings

## Roadmap

- [x] Initial concept and PRD
- [ ] MVP with basic game integration
- [ ] State persistence
- [ ] Statistics dashboard
- [ ] Multiple game support
- [ ] Achievement system
- [ ] Marketplace release

## License

MIT License - see [LICENSE](LICENSE) file for details

## Acknowledgments

- "Die in the Dungeon" by [Alarts](https://alarts.itch.io/) - An excellent roguelike dice game
- Cursor team for the amazing AI coding experience
- VS Code extension API documentation

---

**Note**: This extension is not affiliated with Cursor or Anysphere, Inc. 