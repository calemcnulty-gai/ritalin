# Extension Distribution Strategy for Ritalin

## Overview

This document outlines the research findings and recommendations for distributing the Ritalin extension for Cursor IDE. Based on comprehensive research, we've identified the current landscape, challenges, and best practices for reaching Cursor users effectively.

## Key Findings

### 1. Cursor and VS Code Marketplace Relationship

**Current Situation (2025):**
- Cursor primarily uses the VS Code marketplace for extensions
- Microsoft has started enforcing its Terms of Service more strictly
- The VS Code marketplace is technically restricted to "Visual Studio family of products"
- Cursor is experiencing issues with certain Microsoft extensions (e.g., C/C++ extension)

**Implications:**
- Relying solely on VS Code marketplace for Cursor distribution is risky
- We need a multi-channel distribution strategy
- Direct distribution methods are becoming more important

### 2. Distribution Channels

#### A. VS Code Marketplace (Primary but Uncertain)
**Pros:**
- Largest reach - most Cursor users still access extensions here
- Automatic updates
- Built-in discovery

**Cons:**
- Legal gray area due to Microsoft's ToS
- May face restrictions in the future
- Some Microsoft extensions already blocking Cursor users

**Recommendation:** Continue publishing here but don't rely on it exclusively

#### B. Open VSX Registry (Alternative Marketplace)
**Pros:**
- Open source alternative managed by Eclipse Foundation
- Explicitly allows VS Code forks like Cursor
- Growing adoption

**Cons:**
- Smaller user base
- Less discovery/visibility
- Requires separate publishing workflow

**Recommendation:** Publish here as a backup/alternative channel

#### C. Direct Distribution (.vsix files)
**Pros:**
- Full control over distribution
- No marketplace restrictions
- Can implement custom update mechanisms

**Cons:**
- Manual installation required
- No automatic updates (unless implemented)
- Harder discovery for new users

**Recommendation:** Essential for beta testing and fallback distribution

#### D. GitHub Releases
**Pros:**
- Version control integration
- Easy automation with GitHub Actions
- Direct download links
- Release notes and changelogs

**Cons:**
- Manual installation
- Limited discovery

**Recommendation:** Use for all releases, especially beta versions

### 3. Cursor-Specific Considerations

**Cursor 1.0 Release (June 2025):**
- Official 1.0 release marks maturity
- Growing user base (valued at $9 billion)
- Strong AI integration features
- Active development and updates

**User Behavior:**
- Cursor users are typically early adopters
- Comfortable with manual installation
- Value AI-enhanced development tools

### 4. Beta Testing Strategy

#### A. Closed Beta Approach
1. **GitHub Releases with Direct Downloads**
   - Use pre-release tags
   - Provide .vsix files
   - Include detailed installation instructions

2. **Beta Feedback Collection**
   - GitHub Issues with beta labels
   - Discord/Slack community (if established)
   - In-extension feedback mechanism

3. **Version Management**
   - Use semantic versioning with beta tags (e.g., 1.0.0-beta.1)
   - Clear documentation of beta features
   - Known issues list

#### B. Installation Instructions for Beta Users

```markdown
## Installing Ritalin Beta

1. Download the latest .vsix file from [GitHub Releases](link)
2. Open Cursor
3. Press Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows/Linux)
4. Type "Install from VSIX"
5. Select the downloaded .vsix file
6. Reload Cursor when prompted
```

### 5. Automated Build and Release Pipeline

#### GitHub Actions Workflow

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'
      - 'v*-beta*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Compile TypeScript
        run: npm run compile
        
      - name: Package Extension
        run: |
          npm install -g @vscode/vsce
          vsce package
          
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: '*.vsix'
          prerelease: ${{ contains(github.ref, 'beta') }}
          generate_release_notes: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          
      - name: Publish to VS Code Marketplace
        if: ${{ !contains(github.ref, 'beta') }}
        run: vsce publish
        env:
          VSCE_PAT: ${{ secrets.VSCE_PAT }}
          
      - name: Publish to Open VSX
        if: ${{ !contains(github.ref, 'beta') }}
        run: npx ovsx publish *.vsix
        env:
          OVSX_PAT: ${{ secrets.OVSX_PAT }}
```

### 6. Documentation Requirements

#### A. README.md Updates
- Clear installation instructions for all methods
- Cursor-specific setup notes
- Feature compatibility matrix
- Troubleshooting section

#### B. Installation Guide
```markdown
# Installing Ritalin for Cursor

## Method 1: VS Code Marketplace (Recommended)
1. Open Cursor
2. Go to Extensions (Cmd+Shift+X)
3. Search for "Ritalin"
4. Click Install

## Method 2: Direct Installation
1. Download from [GitHub Releases](link)
2. In Cursor: Cmd+Shift+P → "Install from VSIX"
3. Select the downloaded file

## Method 3: Open VSX Registry
[Instructions for Open VSX installation]
```

#### C. Cursor-Specific Documentation
- AI detection compatibility
- Performance considerations
- Known issues with Cursor
- Optimal settings for Cursor users

### 7. Marketing and Discovery

#### A. Cursor Community Engagement
- Cursor Discord/Forums participation
- Blog posts about Cursor + Ritalin workflow
- Video tutorials specific to Cursor users

#### B. SEO and Discoverability
- Include "Cursor" in extension name/description
- Use relevant keywords: "AI IDE", "Cursor extension", "productivity"
- Create comparison content: "Ritalin vs other Cursor extensions"

#### C. Direct Outreach
- Twitter/X engagement with Cursor community
- Reddit posts in relevant subreddits
- Dev.to articles about the extension

### 8. Update Strategy

#### A. Auto-Update Mechanism
For direct installations, implement a simple update checker:

```typescript
async function checkForUpdates() {
  const currentVersion = context.extension.packageJSON.version;
  const latestRelease = await fetch('https://api.github.com/repos/USER/ritalin/releases/latest');
  const latestVersion = latestRelease.tag_name;
  
  if (semver.gt(latestVersion, currentVersion)) {
    vscode.window.showInformationMessage(
      `Ritalin ${latestVersion} is available!`,
      'Download',
      'Later'
    ).then(selection => {
      if (selection === 'Download') {
        vscode.env.openExternal(vscode.Uri.parse(latestRelease.html_url));
      }
    });
  }
}
```

#### B. Migration Path
- Plan for potential VS Code marketplace restrictions
- Maintain user settings during transitions
- Clear communication about distribution changes

### 9. Legal and Compliance

#### A. License Considerations
- Use MIT or similar permissive license
- Clear attribution for dependencies
- No VS Code branding/trademarks

#### B. Privacy and Data
- Clear privacy policy
- Minimal data collection
- GDPR compliance if applicable

### 10. Success Metrics

#### A. Distribution Metrics
- Downloads per channel
- Active users per platform
- Update adoption rates

#### B. User Engagement
- Beta feedback participation
- GitHub stars/issues
- Community engagement

## Versioning and Build System

### Version Format
- **Production releases**: Semantic versioning (e.g., `0.1.0`, `1.0.0`)
- **Pre-releases**: Use GitHub release tags with `-alpha` suffix (e.g., `v0.1.0-alpha`)
- **Build numbers**: Auto-incremented on each build, stored in metadata

### Version Management Commands

```bash
# View current version info
npm run version:info

# Bump version (patch/minor/major)
npm run version:bump patch
npm run version:bump minor -- --pre-release
npm run version:bump major

# Quick release commands
npm run release:alpha    # Bumps patch version and creates alpha package
npm run release:patch    # Bumps patch version and creates release package
npm run release:minor    # Bumps minor version and creates release package
npm run release:major    # Bumps major version and creates release package

# Manual packaging
npm run package         # Creates .vsix for marketplace
npm run package:alpha   # Creates .vsix marked as pre-release
```

### Build Metadata
- Build numbers are auto-incremented on each package build
- Stored in `.cursor/build-metadata.json`
- Added to package.json as `buildMetadata` field
- Displayed in GitHub releases

### VS Code Marketplace Requirements
- Version must be pure semantic versioning (no pre-release identifiers)
- Icon must be PNG format (not SVG)
- Publisher ID must be registered and verified
- Extension ID should be lowercase with hyphens

## Implementation Plan

### Phase 1: Foundation (Week 1)
1. Set up GitHub Actions for automated builds
2. Create comprehensive installation documentation
3. Prepare beta release with .vsix distribution

### Phase 2: Multi-Channel Launch (Week 2)
1. Publish to VS Code Marketplace
2. Submit to Open VSX Registry
3. Create GitHub Release with .vsix
4. Announce in Cursor communities

### Phase 3: Beta Program (Weeks 3-4)
1. Release beta versions via GitHub
2. Collect user feedback
3. Iterate based on Cursor-specific issues
4. Build community of early adopters

### Phase 4: Marketing Push (Week 5+)
1. Create Cursor-specific content
2. Engage with Cursor community
3. Monitor distribution channels
4. Adjust strategy based on metrics

## Risk Mitigation

### If VS Code Marketplace Blocks Cursor:
1. Immediate pivot to Open VSX + direct distribution
2. Email notification to existing users
3. Update all documentation
4. Increase marketing for alternative channels

### If Cursor Changes Extension API:
1. Maintain compatibility testing
2. Quick patches for breaking changes
3. Clear communication about supported versions

## Conclusion

The key to successful Ritalin distribution for Cursor is **diversification**. Don't rely on a single channel, build a strong direct relationship with users, and be prepared to adapt as the Cursor ecosystem evolves. Focus on providing value to the Cursor community, and distribution channels will follow.

## Resources

- [VS Code Extension Publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Open VSX Publishing Guide](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions)
- [GitHub Actions for VS Code Extensions](https://github.com/marketplace/actions/vscode-vsce)
- [Cursor Official Site](https://cursor.com)
- [Semantic Versioning](https://semver.org/) 