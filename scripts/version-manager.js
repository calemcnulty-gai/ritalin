#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Paths
const packagePath = path.join(__dirname, '..', 'package.json');
const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
const releaseNotesPath = path.join(__dirname, '..', 'RELEASE_NOTES.md');

// Command line arguments
const args = process.argv.slice(2);
const command = args[0];
const isPreRelease = args.includes('--pre-release');

// Read package.json
let packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// Version management functions
function getNextVersion(currentVersion, type) {
    const [major, minor, patch] = currentVersion.split('.').map(Number);
    
    switch (type) {
        case 'major':
            return `${major + 1}.0.0`;
        case 'minor':
            return `${major}.${minor + 1}.0`;
        case 'patch':
            return `${major}.${minor}.${patch + 1}`;
        default:
            throw new Error(`Unknown version type: ${type}`);
    }
}

function updateChangelog(version, isPreRelease) {
    const date = new Date().toISOString().split('T')[0];
    const versionHeader = isPreRelease ? 
        `## [${version}-alpha] - ${date} (Pre-release)` : 
        `## [${version}] - ${date}`;
    
    let changelog = fs.readFileSync(changelogPath, 'utf8');
    
    // Insert new version after the main header
    const lines = changelog.split('\n');
    const insertIndex = lines.findIndex(line => line.startsWith('## [')) || 2;
    
    lines.splice(insertIndex, 0, '', versionHeader, '', '### Added', '- ', '', '### Changed', '- ', '', '### Fixed', '- ', '');
    
    fs.writeFileSync(changelogPath, lines.join('\n'));
    console.log(`Updated CHANGELOG.md for version ${version}`);
}

function createReleaseNotes(version, isPreRelease) {
    const template = `# Release Notes - v${version}${isPreRelease ? ' (Alpha)' : ''}

## What's New

- 

## Bug Fixes

- 

## Known Issues

- 

## Installation

${isPreRelease ? 
`### Alpha Release Installation

1. Download the \`.vsix\` file from the [releases page](https://github.com/ritalin-dev/ritalin/releases)
2. In Cursor, open the command palette (Cmd+Shift+P)
3. Run "Extensions: Install from VSIX..."
4. Select the downloaded file

**Note**: This is an alpha release and may contain bugs.` : 
`### From VS Code Marketplace

1. Open Cursor
2. Go to Extensions (Cmd+Shift+X)
3. Search for "Ritalin"
4. Click Install

### Manual Installation

1. Download the \`.vsix\` file from the [releases page](https://github.com/ritalin-dev/ritalin/releases)
2. In Cursor, open the command palette (Cmd+Shift+P)
3. Run "Extensions: Install from VSIX..."
4. Select the downloaded file`}

## Feedback

Please report any issues on our [GitHub repository](https://github.com/ritalin-dev/ritalin/issues).
`;

    fs.writeFileSync(releaseNotesPath, template);
    console.log(`Created RELEASE_NOTES.md for version ${version}`);
}

// Main logic
switch (command) {
    case 'bump':
        const versionType = args[1] || 'patch';
        const newVersion = getNextVersion(packageJson.version, versionType);
        
        // Update package.json
        packageJson.version = newVersion;
        fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
        
        // Update changelog
        updateChangelog(newVersion, isPreRelease);
        
        // Create release notes template
        createReleaseNotes(newVersion, isPreRelease);
        
        console.log(`Version bumped to ${newVersion}${isPreRelease ? ' (pre-release)' : ''}`);
        break;
        
    case 'prepare-release':
        // Run build number increment
        execSync('node scripts/increment-build.js', { stdio: 'inherit' });
        
        // Create git tag if not pre-release
        if (!isPreRelease) {
            const tagName = `v${packageJson.version}`;
            try {
                execSync(`git tag ${tagName}`, { stdio: 'inherit' });
                console.log(`Created git tag: ${tagName}`);
            } catch (e) {
                console.log(`Tag ${tagName} might already exist`);
            }
        }
        break;
        
    case 'info':
        console.log(`Current version: ${packageJson.version}`);
        if (packageJson.buildMetadata) {
            console.log(`Build number: ${packageJson.buildMetadata.buildNumber}`);
            console.log(`Last build: ${packageJson.buildMetadata.timestamp}`);
        }
        break;
        
    default:
        console.log(`
Version Manager for Ritalin Extension

Usage:
  node scripts/version-manager.js <command> [options]

Commands:
  bump <major|minor|patch>  Bump version and update changelog
  prepare-release          Prepare for release (increment build, create tag)
  info                     Show current version info

Options:
  --pre-release            Mark as pre-release (alpha/beta)

Examples:
  npm run version:bump patch
  npm run version:bump minor --pre-release
  npm run version:prepare-release
        `);
} 