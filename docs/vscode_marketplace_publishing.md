# VS Code Marketplace Publishing Guide

## Overview

This guide walks through publishing the Ritalin extension to the VS Code Marketplace. Note that while this will make the extension available to Cursor users (since Cursor uses the VS Code marketplace), there are potential risks due to Microsoft's Terms of Service.

## Step 1: Create a Publisher Account

### 1.1 Create Azure DevOps Account
1. Go to https://dev.azure.com/
2. Sign in with a Microsoft account (or create one)
3. Create a new organization if you don't have one

### 1.2 Create a Publisher
1. Go to https://marketplace.visualstudio.com/manage
2. Click "Create publisher"
3. Choose a publisher ID (e.g., "ritalin-dev")
4. Fill in:
   - Display name: "Ritalin Development"
   - Description: "Developer tools for enhanced productivity"
   - Logo (optional but recommended)

## Step 2: Generate Personal Access Token (PAT)

1. In Azure DevOps (https://dev.azure.com/):
   - Click on User Settings (top right) → Personal Access Tokens
   - Click "New Token"
   - Name: "vsce-publish"
   - Organization: Select your org
   - Expiration: 90 days (or custom)
   - Scopes: Click "Show all scopes" and select:
     - **Marketplace**: Acquire, Publish, Manage
   - Click "Create"
   - **COPY THE TOKEN NOW** (you won't see it again!)

2. Save the token securely (e.g., in a password manager)

## Step 3: Update Extension Metadata

### 3.1 Update package.json

```json
{
  "publisher": "ritalin-dev",  // Must match your publisher ID
  "icon": "media/icon.png",     // 128x128 PNG recommended
  "galleryBanner": {
    "color": "#1e1e1e",
    "theme": "dark"
  },
  "keywords": [
    "cursor",
    "ai",
    "productivity",
    "games",
    "focus"
  ],
  "categories": [
    "Other"
  ],
  "badges": [
    {
      "url": "https://img.shields.io/badge/Alpha-v0.1.0-yellow",
      "href": "https://github.com/ritalin-dev/ritalin/releases",
      "description": "Alpha Release"
    }
  ]
}
```

### 3.2 Create/Update CHANGELOG.md

```markdown
# Change Log

## [0.1.0-alpha.1] - 2025-01-14
### Added
- Initial alpha release
- AI detection for Cursor
- External game window
- itch.io game integration
```

### 3.3 Add Icon
- Create a 128x128 PNG icon
- Place it in `media/icon.png`
- Should be clear on both light and dark backgrounds

## Step 4: Prepare for Publishing

### 4.1 Update README for Marketplace
- Remove development setup instructions
- Focus on user-facing features
- Add screenshots/GIFs
- Include clear installation instructions

### 4.2 Add Marketplace-Specific Files

Create `MARKETPLACE_README.md`:
```markdown
# Ritalin for Cursor

Stay focused during AI code generation with mini-games!

## Features
- 🤖 Automatic AI detection
- 🎮 Instant mini-games
- 🎯 Productivity tracking
- ⚙️ Fully configurable

## Installation
1. Install from VS Code Marketplace
2. Open Cursor
3. Start coding with AI!

## Note
This extension is designed specifically for Cursor IDE.
```

## Step 5: Test Packaging

```bash
# Install vsce globally if not already
npm install -g @vscode/vsce

# Package without publishing
vsce package

# This creates a .vsix file - test it locally first!
```

## Step 6: Publish to Marketplace

### 6.1 First Time Setup
```bash
# Login with your PAT
vsce login ritalin-dev
# Enter your PAT when prompted
```

### 6.2 Publish
```bash
# Publish directly
vsce publish

# Or publish a specific version
vsce publish 0.1.0

# Or publish a pre-packaged .vsix
vsce publish -p ritalin-0.1.0.vsix
```

### 6.3 Publish with Version Bump
```bash
# Publish and bump patch version
vsce publish patch  # 0.1.0 → 0.1.1

# Publish and bump minor version
vsce publish minor  # 0.1.0 → 0.2.0

# Publish and bump major version
vsce publish major  # 0.1.0 → 1.0.0
```

## Step 7: Post-Publishing

### 7.1 Verify Publication
- Go to https://marketplace.visualstudio.com/items?itemName=ritalin-dev.ritalin
- Check that all information displays correctly
- Test installation from marketplace

### 7.2 Monitor Metrics
- View install counts
- Check ratings and reviews
- Monitor crash reports

## Important Considerations for Cursor Extensions

### ⚠️ Risks
1. **Terms of Service**: Microsoft's ToS technically restricts marketplace to "Visual Studio family"
2. **Potential Removal**: Extension could be removed if Microsoft enforces ToS strictly
3. **Feature Compatibility**: Some Cursor-specific features might not work in regular VS Code

### 🛡️ Mitigation Strategies
1. **Clear Documentation**: State that the extension is "optimized for Cursor IDE"
2. **Graceful Degradation**: Ensure extension doesn't crash in regular VS Code
3. **Multi-Channel Distribution**: Always maintain GitHub releases as backup
4. **User Communication**: Build email list or Discord for updates if removed

## Automation with GitHub Actions

Add to `.github/workflows/release.yml`:

```yaml
- name: Publish to VS Code Marketplace
  if: ${{ !contains(github.ref, 'alpha') && !contains(github.ref, 'beta') }}
  run: |
    npm install -g @vscode/vsce
    vsce publish -p ${{ secrets.VSCE_PAT }}
  env:
    VSCE_PAT: ${{ secrets.VSCE_PAT }}
```

Add PAT as GitHub Secret:
1. Go to repo Settings → Secrets → Actions
2. Add secret named `VSCE_PAT`
3. Paste your Azure DevOps PAT

## Checklist Before Publishing

- [ ] Icon added (128x128 PNG)
- [ ] Publisher ID in package.json
- [ ] Keywords optimized for search
- [ ] README marketplace-ready
- [ ] CHANGELOG.md updated
- [ ] Version number appropriate
- [ ] Tested .vsix locally
- [ ] Screenshots added (if applicable)
- [ ] PAT generated and saved
- [ ] Backup distribution plan ready

## Common Issues

### "Publisher not found"
- Ensure publisher ID in package.json matches exactly
- Verify you're logged in: `vsce ls-publishers`

### "Invalid PAT"
- Check PAT hasn't expired
- Ensure Marketplace scopes are selected
- Try generating a new PAT

### "Missing icon"
- Icon must be exactly 128x128 pixels
- Use PNG format
- Path in package.json must be correct

## Next Steps After Publishing

1. **Announce**: Post on social media, Reddit, forums
2. **Monitor**: Watch for user issues and feedback
3. **Iterate**: Plan quick updates based on feedback
4. **Engage**: Respond to reviews and issues
5. **Track**: Monitor install counts and usage 