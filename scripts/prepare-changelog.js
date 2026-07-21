#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getNextVersion() {
  const appJsonPath = path.join(__dirname, '..', 'app.json');
  if (!fs.existsSync(appJsonPath)) {
    console.error('app.json not found');
    process.exit(1);
  }
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  const currentVersion = appJson.expo?.version || '1.0.0';
  const versionParts = currentVersion.split('.').map(Number);
  if (versionParts.length >= 3 && !versionParts.some(isNaN)) {
    versionParts[2] += 1;
  } else {
    versionParts[0] = 1;
    versionParts[1] = 0;
    versionParts[2] = 1;
  }
  return versionParts.join('.');
}

function getGitCommits() {
  let lastTag = '';
  try {
    lastTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch (e) {
    // No tag found
  }

  let commitsCmd = 'git log --oneline -n 15';
  if (lastTag) {
    commitsCmd = `git log ${lastTag}..HEAD --oneline`;
  }

  try {
    const commits = execSync(commitsCmd, { encoding: 'utf8', stdio: 'pipe' }).trim();
    if (!commits) return '* No commits found since last release.';
    return commits
      .split('\n')
      .map(line => `- ${line}`)
      .join('\n');
  } catch (e) {
    return '* Error fetching commits or not in a git repository.';
  }
}

function run() {
  const nextVer = getNextVersion();
  const changelogDir = path.join(__dirname, '..', 'changelogs');
  if (!fs.existsSync(changelogDir)) {
    fs.mkdirSync(changelogDir, { recursive: true });
  }

  const changelogPath = path.join(changelogDir, `v${nextVer}.md`);
  if (fs.existsSync(changelogPath)) {
    console.log(`EXISTS:${nextVer}:${changelogPath}`);
    return;
  }

  const dateStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Kolkata'
  });

  const commitsList = getGitCommits();

  const template = `# Release Changelog v${nextVer}

*Released on: ${dateStr}*

### 🚀 New Features
- [Enter new features here]

### 🐛 Bug Fixes
- [Enter bug fixes here]

### 🎨 UI Improvements
- [Enter UI improvements here]

### 📝 Git Commits in this Build
${commitsList}
`;

  fs.writeFileSync(changelogPath, template, 'utf8');
  console.log(`CREATED:${nextVer}:${changelogPath}`);
}

run();
