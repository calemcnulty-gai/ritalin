# Contributing to Ritalin for Cursor

Thank you for your interest in contributing to Ritalin! This guide will help you get started with development.

## 🛠️ Development Setup

### Prerequisites

- Node.js (v16 or later)
- Python 3 (for game downloading scripts)
- npm
- Cursor or VS Code for development

### Getting Started

```bash
# Clone the repository
git clone https://github.com/ritalin-dev/ritalin.git
cd ritalin

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes during development
npm run watch
```

### Testing the Extension

1. Open the project in VS Code/Cursor
2. Press `F5` to launch Extension Development Host
3. The extension will be loaded in the new window
4. Test with Cursor AI features

## 📁 Project Structure

```
ritalin/
├── src/                    # TypeScript source files
│   ├── extension.ts       # Main extension entry point
│   ├── cursorDetector.ts  # AI detection system
│   ├── GameWindowManager.ts # External game window
│   ├── gameManager.ts     # Game download/management
│   └── ConfigPanel.ts     # Configuration UI
├── electron-game-window/   # Electron app for games
├── scripts/               # Python scripts for game downloading
├── media/                 # Static assets and bundled games
├── docs/                  # Documentation
└── .cursor/              # Project management files
```

## 🔧 Key Commands

```bash
# Development
npm run compile          # Compile TypeScript
npm run watch           # Watch mode for development
npm run lint            # Run ESLint

# Packaging
npm run package         # Create .vsix for production
npm run package:alpha   # Create .vsix for pre-release

# Version Management
npm run version:bump patch    # Bump patch version
npm run version:bump minor    # Bump minor version
npm run version:bump major    # Bump major version
npm run release:alpha         # Create alpha release
```

## 🏗️ Architecture Overview

### AI Detection System
- **File Watching**: Monitors `.cursor/is_working` file
- **Cursor Rules**: Auto-creates rules for AI self-reporting
- **Timeout Safety**: 60-second timeout prevents stuck states

### Game Window Management
- **Electron Process**: Spawns external window for games
- **IPC Communication**: JSON messages between extension and window
- **State Persistence**: Saves game state between sessions

### Game Management
- **Python Scripts**: Download games from itch.io
- **Local Storage**: Games stored in global extension storage
- **Configuration**: User preferences for selected game

## 🧪 Testing Guidelines

### Manual Testing Checklist
- [ ] Extension activates without errors
- [ ] AI detection triggers on Cursor AI usage
- [ ] Game window appears/hides correctly
- [ ] Games download successfully
- [ ] State persists between sessions
- [ ] Pause/unpause works via status bar
- [ ] Configuration page displays properly

### Adding New Games
1. Add game metadata to `scripts/curated_games.json`
2. Add cover image to `media/game-images/`
3. Test download with `python3 scripts/grab_itch_game.py [url] [id] [output]`
4. Verify game loads in Electron window

## 📝 Code Style

- Use TypeScript for all source files
- Follow existing code formatting
- Add JSDoc comments for public APIs
- Use meaningful variable names
- Handle errors gracefully with try/catch

## 🐛 Debugging Tips

### Extension Issues
- Check Output panel → "Ritalin" for logs
- Use `console.log` in extension code (appears in output)
- Check Developer Tools for webview issues

### Electron Window Issues
- Logs appear in terminal when running from source
- Use Chrome DevTools in Electron window (Cmd+Shift+I)
- Check `electron-game-window/main.js` for server issues

### Python Script Issues
- Run scripts directly: `python3 scripts/grab_itch_game.py`
- Check for missing dependencies
- Verify network connectivity

## 📦 Creating a Release

1. Update version in `package.json`
2. Update `RELEASE_NOTES.md`
3. Commit changes
4. Create and push tag: `git tag v0.x.x && git push origin v0.x.x`
5. GitHub Actions will automatically create release

## 🤝 Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Commit with clear messages: `git commit -m 'feat: add amazing feature'`
5. Push to your fork: `git push origin feature/amazing-feature`
6. Open a Pull Request with:
   - Clear description of changes
   - Screenshots if UI changes
   - Testing steps
   - Related issue numbers

## 📋 Development Workflow

1. Check [Project Plan](.cursor/project_plan.md) for current tasks
2. Update [Changelog](.cursor/changelog.md) as you work
3. Follow existing patterns and conventions
4. Test thoroughly before submitting PR

## 🆘 Getting Help

- Check existing [GitHub Issues](https://github.com/ritalin-dev/ritalin/issues)
- Read through [docs/](docs/) folder
- Ask questions in PR comments
- Review [brainlift.md](brainlift.md) for technical insights

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License. 