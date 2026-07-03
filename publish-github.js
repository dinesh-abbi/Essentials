#!/usr/bin/env node
/**
 * publish-github.js
 *
 * Builds the Android release APK and publishes it as a GitHub Release asset.
 *
 * Prerequisites:
 *   - `gh` CLI authenticated: gh auth login
 *   - Gradle wrapper present at ./android/gradlew
 *   - JDK 17 active (required by this project's Android build)
 *
 * Usage:
 *   npm run publish
 *
 * Before every run:
 *   1. Bump "version" in app.json       (e.g. "1.0.0" → "1.0.1")
 *   2. Bump "android.versionCode"       (e.g. 2 → 3)
 *   3. Commit and push the version bump to the repo
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─────────────────────────────────────────────────────────────────────────────
// 1. Read version from app.json
// ─────────────────────────────────────────────────────────────────────────────
const appJsonPath = path.join(__dirname, 'app.json');
if (!fs.existsSync(appJsonPath)) {
  console.error('❌  Error: app.json not found in project root.');
  process.exit(1);
}

const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const version = appJson.expo?.version;
const versionCode = appJson.expo?.android?.versionCode;

if (!version) {
  console.error('❌  Error: expo.version not found in app.json.');
  process.exit(1);
}
if (!versionCode) {
  console.warn('⚠️   Warning: expo.android.versionCode not set in app.json.');
  console.warn('    Android will reject the update if versionCode is not incremented.');
}

const tag = `v${version}`;
console.log(`\n📦  Publishing Essentials ${tag}  (versionCode: ${versionCode ?? 'unset'})\n`);

// ─────────────────────────────────────────────────────────────────────────────
// 2. Build the Android release APK
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
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Validate the compiled APK exists
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
  console.error('    Make sure the Gradle build succeeded and signing is configured.');
  process.exit(1);
}

const apkSizeMB = (fs.statSync(apkPath).size / 1024 / 1024).toFixed(1);
console.log(`\n📂  APK ready: ${apkPath}  (${apkSizeMB} MB)`);

// ─────────────────────────────────────────────────────────────────────────────
// 4. Verify gh CLI is available and authenticated
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n🔐  Verifying GitHub CLI authentication...');
try {
  // `gh auth token` only checks the *active* account — exits 0 with a valid token.
  // `gh auth status` is intentionally avoided: it exits 1 when *any* secondary
  // account in the keyring has an invalid token, causing false "not authenticated" errors.
  const token = execSync('gh auth token', { encoding: 'utf8', stdio: 'pipe' }).trim();
  if (!token) throw new Error('Empty token');
  console.log('✅  GitHub CLI authenticated as active account.');
} catch {
  console.error('❌  GitHub CLI is not authenticated. Run: gh auth login');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Create the GitHub Release and upload the APK
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
    console.error('    Bump the version in app.json before publishing again.');
  } else {
    console.error('\n❌  Failed to create GitHub Release:', stderr || err.message);
  }
  process.exit(1);
}
