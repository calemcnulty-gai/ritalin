# 🎮 Ritalin for Cursor

> Turn AI generation wait time into game time. Stay focused, not distracted.

[![Version](https://img.shields.io/badge/version-0.2.0-blue)](https://github.com/ritalin-dev/ritalin/releases)
[![Alpha](https://img.shields.io/badge/status-alpha-yellow)](https://github.com/ritalin-dev/ritalin/releases)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## What is Ritalin?

When Cursor AI generates code, you wait 15-60 seconds. Most developers switch to Reddit or Twitter, losing focus and taking 5-10 minutes to recover. 

**Ritalin keeps you in the zone** by automatically showing mini-games during AI generation. When the AI finishes, the game disappears and you're right back to coding - no context switch, no lost time.

## ✨ Key Features

### 🤖 Automatic AI Detection
Knows exactly when Cursor is generating code - no manual triggers needed.

### 🎮 Instant Gaming
Games appear within milliseconds of AI starting, hide instantly when done.

### 💾 Persistent Progress
Your game saves automatically. Pick up exactly where you left off.

### 🎯 Curated Game Selection
8 hand-picked games perfect for quick breaks - from chess to roguelikes.

### ⏸️ Smart Controls
Pause anytime via the status bar. Full control when you need deep focus.

### 🖥️ Multi-Monitor Ready
Games position intelligently on any screen setup.

## 🚀 Getting Started

### 1. Install Ritalin

Download the latest version:
- **[⬇️ Download v0.2.0](https://github.com/ritalin-dev/ritalin/releases/download/v0.2.0/ritalin-0.2.0.vsix)**

Install in Cursor:
1. Open Command Palette (`Cmd+Shift+P` on Mac, `Ctrl+Shift+P` on Windows/Linux)
2. Type "Install from VSIX"
3. Select the downloaded file
4. Reload when prompted

### 2. Choose Your Game

After installation, a configuration page opens automatically. Pick from:

#### 🏆 Featured Games

**♟️ Chess vs AI** (Bundled)
- Battle Stockfish AI at multiple difficulty levels
- Clean, minimalist interface
- No download required

**🎲 Die in the Dungeon**
- Dice-based roguelike with deep strategy
- Perfect for 30-second rounds
- Most popular choice

**📁 Folder Dungeon**
- Explore dungeons inside computer folders
- Unique premise with solid gameplay

#### 🕹️ More Games

- **Slipways Classic** - Minimalist space strategy
- **Shogun Showdown** - Turn-based tactical combat
- **Backpack Hero** - Inventory management roguelike
- **Solitomb** - Solitaire meets dungeon crawler
- **Porklike** - Classic roguelike experience

### 3. Start Coding

That's it! Use Cursor AI normally. Games appear automatically during generation.

## ⚙️ Customization

### Window Position

Set your preferred game location:

```json
{
  "ritalin.externalWindow.position": "bottom-right"
}
```

Options: `bottom-left`, `bottom-right`, `top-left`, `top-right`, `center`, `overlay`

### Window Size

Adjust to your screen:

```json
{
  "ritalin.externalWindow.width": 800,
  "ritalin.externalWindow.height": 600
}
```

### Advanced Settings

- `alwaysOnTop`: Keep game window above other windows
- `monitor`: Choose `primary`, `secondary`, or `auto`
- `hideOnBlur`: Auto-hide when game loses focus

## 💡 Tips & Tricks

### Quick Commands
- **Show Config**: `Cmd+Shift+P` → "Ritalin: Show Configuration Page"
- **Manage Games**: `Cmd+Shift+P` → "Ritalin: Manage Downloaded Games"
- **Toggle On/Off**: Click the status bar icon

### Status Bar
- **🎮 Ritalin: Active** - AI detection is on
- **⏸️ Ritalin: Paused** - AI detection is off

### Pro Tips
- Games save state automatically - don't worry about losing progress
- Try different games to find your perfect focus companion
- Adjust window opacity in game settings for overlay mode
- Use pause during important debugging sessions

## 🔧 Troubleshooting

<details>
<summary><strong>Game window doesn't appear</strong></summary>

1. Check status bar shows "Ritalin: Active" (not paused)
2. Ensure a game is selected: `Cmd+Shift+P` → "Show Configuration"
3. Check Output panel → "Ritalin" for errors
4. Try reloading: `Cmd+R` (Mac) or `Ctrl+R` (Windows/Linux)

</details>

<details>
<summary><strong>Game won't download</strong></summary>

1. Verify Python 3 is installed: `python3 --version`
2. Check your internet connection
3. Note: Some games are 30-180MB and take time
4. Try downloading a different game first

</details>

<details>
<summary><strong>First-time setup issues</strong></summary>

1. Electron may need to install on first run (one-time, automatic)
2. The extension creates files in `.cursor/` - ensure folder isn't read-only
3. If configuration page doesn't open, use Command Palette

</details>

<details>
<summary><strong>Performance concerns</strong></summary>

- Games run in isolated process - no impact on Cursor
- Typical memory usage: 50-150MB
- CPU usage: <5% when idle, 10-20% during gameplay
- Games auto-pause when hidden

</details>

## 🎯 Why Ritalin?

### The Problem
- Average developer checks social media 50+ times per day
- Each context switch costs 23 minutes of productivity
- AI generation creates dozens of micro-breaks daily
- Traditional solutions (blocking sites) don't address the root cause

### Our Solution
- **Structured distraction** that maintains cognitive engagement
- **Zero-friction** activation - no decisions needed
- **Time-boxed** entertainment that ends with AI generation
- **Flow-state preservation** through consistent context

## 📊 What's New in v0.2.0

- ⏸️ **Pause/Unpause** - Status bar control for AI detection
- 🐛 **Better State Management** - Improved reliability
- 📝 **Enhanced Logging** - Easier troubleshooting
- 🎮 **Bundled Chess** - Instant game, no download needed

## 🗺️ Roadmap

### Coming Soon
- 📈 Productivity analytics
- 🎮 More game variety
- 🏆 Achievement system
- 🌐 Custom game URLs

### Under Consideration
- 👥 Multiplayer modes
- 🎨 Theme customization
- 📱 Mobile companion
- 🔌 API for game developers

## 💬 Community & Support

- **Issues & Bugs**: [GitHub Issues](https://github.com/ritalin-dev/ritalin/issues)
- **Feature Requests**: [Open a discussion](https://github.com/ritalin-dev/ritalin/issues/new)
- **Security**: See [SECURITY.md](SECURITY.md)

## 🛠️ For Developers

Want to contribute or customize Ritalin? Check out our [Contributing Guide](CONTRIBUTING.md) for development setup, architecture overview, and guidelines.

## 📜 License

MIT License - see [LICENSE](LICENSE)

---

<p align="center">
  <strong>Stop context switching. Start Ritalin.</strong><br>
  Made with ❤️ for developers who value their focus
</p> 