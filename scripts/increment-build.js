#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Path to package.json
const packagePath = path.join(__dirname, '..', 'package.json');

// Path to build metadata file
const buildMetaPath = path.join(__dirname, '..', '.cursor', 'build-metadata.json');

// Read package.json
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// Initialize or read build metadata
let buildMeta = { buildNumber: 0 };
if (fs.existsSync(buildMetaPath)) {
    try {
        buildMeta = JSON.parse(fs.readFileSync(buildMetaPath, 'utf8'));
    } catch (e) {
        console.log('Creating new build metadata file...');
    }
}

// Increment build number
buildMeta.buildNumber = (buildMeta.buildNumber || 0) + 1;
buildMeta.lastBuild = new Date().toISOString();
buildMeta.version = packageJson.version;

// Save build metadata
fs.mkdirSync(path.dirname(buildMetaPath), { recursive: true });
fs.writeFileSync(buildMetaPath, JSON.stringify(buildMeta, null, 2));

// Update package.json with build metadata
// Note: We don't modify the version field itself as it must remain semver-compliant
// Instead, we'll add build info to a custom field
packageJson.buildMetadata = {
    buildNumber: buildMeta.buildNumber,
    timestamp: buildMeta.lastBuild
};

// Write updated package.json
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');

console.log(`Build number incremented to: ${buildMeta.buildNumber}`);
console.log(`Version: ${packageJson.version} (Build ${buildMeta.buildNumber})`);

// If we're in a pre-release build, update the display name to include alpha/beta info
if (process.argv.includes('--pre-release')) {
    packageJson.displayName = `${packageJson.displayName} (Alpha Build ${buildMeta.buildNumber})`;
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log('Updated display name for pre-release build');
} 