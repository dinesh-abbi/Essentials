#!/usr/bin/env node
/**
 * publish-github.js
 *
 * Automatically increments the version and versionCode, builds the Android release APK,
 * commits/pushes the version bump, and publishes it as a GitHub Release asset.
 *
 * It will:
 *   1. Check for changes since the last tag. If none are found, it skips release (unless --force is passed).
 *   2. Clean up old GitHub releases/tags so only the latest one remains.
 *
 * Prerequisites:
 *   - `gh` CLI authenticated: gh auth login
 *   - Gradle wrapper present at ./android/gradlew
 *   - JDK 17 active (configured via android/gradle.properties)
 *
 * Usage:
 *   npm run publish [-- --force]
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Helper to run shell commands safely
function runCmd(cmd, options = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', ...options });
  } catch (err) {
    throw new Error(err.stderr || err.message || `Command failed: ${cmd}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 0. Change Detection & Force Check
// ─────────────────────────────────────────────────────────────────────────────
const force = process.argv.includes('--force');
let hasChanges = false;
let lastTagName = '';

try {
  lastTagName = execSync('git describe --tags --abbrev=0', { encoding: 'utf8', stdio: 'pipe' }).trim();
  const commitsSinceTag = execSync(`git log ${lastTagName}..HEAD --oneline`, { encoding: 'utf8', stdio: 'pipe' }).trim();
  if (commitsSinceTag) {
    hasChanges = true;
  }
} catch (err) {
  // If no tag is found or git describe fails, assume there are changes (first build)
  hasChanges = true;
}

// Check for any uncommitted changes in tracked files (excluding config files that we bump)
try {
  const statusRaw = execSync('git status --porcelain', { encoding: 'utf8', stdio: 'pipe' }).trim();
  if (statusRaw) {
    const lines = statusRaw.split('\n');
    const dirtyFiles = lines.filter(line => {
      const file = line.substring(3).trim();
      return file !== 'app.json' && file !== 'package.json';
    });
    if (dirtyFiles.length > 0) {
      hasChanges = true;
    }
  }
} catch (err) {
  // If git status fails, default to true
  hasChanges = true;
}

if (!hasChanges && !force) {
  console.log(`\nℹ️   No new commits or modifications detected since the last tag (${lastTagName || 'none'}).`);
  console.log('    Skipping build and release to prevent version inflation.');
  console.log('    Use: npm run publish -- --force to run build anyway.\n');
  process.exit(0);
}

if (force) {
  console.log('⚠️   Force flag active: Skipping change detection checks.');
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Read files and backup initial state
// ─────────────────────────────────────────────────────────────────────────────
const appJsonPath = path.join(__dirname, 'app.json');
const packageJsonPath = path.join(__dirname, 'package.json');

if (!fs.existsSync(appJsonPath)) {
  console.error('❌  Error: app.json not found in project root.');
  process.exit(1);
}

const originalAppJsonRaw = fs.readFileSync(appJsonPath, 'utf8');
const appJson = JSON.parse(originalAppJsonRaw);

let originalPackageJsonRaw = null;
let packageJson = null;
if (fs.existsSync(packageJsonPath)) {
  originalPackageJsonRaw = fs.readFileSync(packageJsonPath, 'utf8');
  packageJson = JSON.parse(originalPackageJsonRaw);
}

const currentVersion = appJson.expo?.version || '1.0.0';
const currentVersionCode = appJson.expo?.android?.versionCode || 1;

// ─────────────────────────────────────────────────────────────────────────────
// 2. Compute and apply version increment
// ─────────────────────────────────────────────────────────────────────────────
const versionParts = currentVersion.split('.').map(Number);
if (versionParts.length >= 3 && !versionParts.some(isNaN)) {
  versionParts[2] += 1;
} else {
  versionParts[0] = 1;
  versionParts[1] = 0;
  versionParts[2] = 1;
}
const newVersion = versionParts.join('.');
const newVersionCode = currentVersionCode + 1;

// Apply changes in memory
appJson.expo = appJson.expo || {};
appJson.expo.version = newVersion;
appJson.expo.android = appJson.expo.android || {};
appJson.expo.android.versionCode = newVersionCode;

if (packageJson) {
  packageJson.version = newVersion;
}

const tag = `v${newVersion}`;
console.log(`\n📦  Incrementing version: ${currentVersion} (code: ${currentVersionCode}) ➡️  ${newVersion} (code: ${newVersionCode})\n`);

// Save updated configs to disk
fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n', 'utf8');
if (packageJson) {
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
}

// Revert function in case of compile failure
function revertVersionBump() {
  console.log('🔄  Reverting version bump changes to app.json / package.json...');
  fs.writeFileSync(appJsonPath, originalAppJsonRaw, 'utf8');
  if (originalPackageJsonRaw) {
    fs.writeFileSync(packageJsonPath, originalPackageJsonRaw, 'utf8');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Build the Android release APK
// ─────────────────────────────────────────────────────────────────────────────
console.log('🔨  Building release APK via Gradle...\n');
try {
  execSync('./gradlew assembleRelease', {
    cwd: path.join(__dirname, 'android'),
    stdio: 'inherit',
    env: { ...process.env },
  });
  console.log('\n✅  Gradle build completed successfully.');
} catch (err) {
  console.error('\n❌  Gradle build failed.', err.message ?? err);
  revertVersionBump();
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Validate the compiled APK exists
// ─────────────────────────────────────────────────────────────────────────────
const apkPath = path.join(
  __dirname,
  'android',
  'app',
  'build',
  'outputs',
  'apk',
  'release',
  'app-release.apk'
);

if (!fs.existsSync(apkPath)) {
  console.error(`❌  Error: Compiled APK not found at:\n    ${apkPath}`);
  revertVersionBump();
  process.exit(1);
}

const apkSizeMB = (fs.statSync(apkPath).size / 1024 / 1024).toFixed(1);
console.log(`\n📂  APK ready: ${apkPath}  (${apkSizeMB} MB)`);

// ─────────────────────────────────────────────────────────────────────────────
// 5. Verify gh CLI is available and authenticated
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n🔐  Verifying GitHub CLI authentication...');
try {
  const token = execSync('gh auth token', { encoding: 'utf8', stdio: 'pipe' }).trim();
  if (!token) throw new Error('Empty token');
  console.log('✅  GitHub CLI authenticated as active account.');
} catch {
  console.error('❌  GitHub CLI is not authenticated. Run: gh auth login');
  revertVersionBump();
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Commit version bump and push changes to git
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n💾  Committing version bump to git...');
try {
  runCmd('git add app.json');
  if (packageJson) {
    runCmd('git add package.json');
  }
  runCmd(`git commit -m "chore: bump version to ${tag}"`);
  console.log('✅  Version bump committed.');

  console.log('📤  Pushing commit to git upstream...');
  let branchName = 'main';
  try {
    branchName = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
  } catch {}
  runCmd(`git push origin ${branchName || 'main'}`);
  console.log('✅  Git push completed.');
} catch (err) {
  console.error('⚠️   Warning: Git commit/push failed.', err.message);
  console.log('Continuing with release creation using built assets...');
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Create the GitHub Release and upload the APK
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n🚀  Creating GitHub Release ${tag} and uploading APK...\n`);

const releaseCommand = [
  'gh release create',
  `"${tag}"`,
  `"${apkPath}"`,
  `--title "Essentials ${tag}"`,
  '--generate-notes',
].join(' ');

try {
  const output = execSync(releaseCommand, { encoding: 'utf8' });
  console.log('\n🎉  Release published successfully!');
  console.log('    URL:', output.trim());
} catch (err) {
  const stderr = err.stderr?.toString() ?? '';
  if (stderr.includes('already exists')) {
    console.error(`\n❌  Release ${tag} already exists on GitHub.`);
  } else {
    console.error('\n❌  Failed to create GitHub Release:', stderr || err.message);
  }
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Clean up older GitHub releases and tags
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n🧹  Cleaning up older GitHub releases and tags...');
try {
  const releasesRaw = execSync('gh release list --limit 100', { encoding: 'utf8', stdio: 'pipe' }).trim();
  if (releasesRaw) {
    const oldTags = releasesRaw
      .split('\n')
      .map(line => {
        const parts = line.split(/\s+/);
        return parts[0]?.trim();
      })
      .filter(t => t && /^v\d+\.\d+\.\d+$/.test(t) && t !== tag);

    if (oldTags.length > 0) {
      console.log(`Found ${oldTags.length} older releases to delete: ${oldTags.join(', ')}`);
      for (const oldTag of oldTags) {
        console.log(`Deleteting old release and remote tag: ${oldTag}`);
        try {
          execSync(`gh release delete "${oldTag}" --yes --cleanup-tag`, { stdio: 'ignore' });
        } catch (e) {
          console.warn(`Failed to delete release/tag ${oldTag} from remote:`, e.message);
        }

        try {
          execSync(`git tag -d "${oldTag}"`, { stdio: 'ignore' });
        } catch (e) {
          // ignore if local tag delete fails
        }
      }
      console.log('✅  Cleanup complete. Only the latest release remains.');
    } else {
      console.log('No older releases found to clean up.');
    }
  }
} catch (err) {
  console.warn('⚠️   Warning: Cleanup of old releases failed:', err.message);
}
