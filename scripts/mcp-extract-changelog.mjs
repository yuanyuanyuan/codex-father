#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const [,, versionArg] = process.argv;
if (!versionArg) {
  console.error('[mcp-extract-changelog] missing version argument');
  process.exit(1);
}

const version = versionArg.trim();
const changelogPath = path.resolve('mcp/codex-mcp-server/CHANGELOG.md');
if (!fs.existsSync(changelogPath)) {
  console.error(`[mcp-extract-changelog] changelog not found: ${changelogPath}`);
  process.exit(1);
}

const content = fs.readFileSync(changelogPath, 'utf8');
const lines = content.split(/\r?\n/);
const headingPattern = new RegExp(`^#{2,3}\\s*\\[?${version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]?`);
let startIndex = -1;
for (let i = 0; i < lines.length; i += 1) {
  if (headingPattern.test(lines[i])) {
    startIndex = i;
    break;
  }
}

if (startIndex === -1) {
  console.error(`[mcp-extract-changelog] could not find changelog entry for ${version}`);
  process.exit(1);
}

let endIndex = lines.length;
for (let i = startIndex + 1; i < lines.length; i += 1) {
  if (/^##\s/.test(lines[i]) && i !== startIndex) {
    endIndex = i;
    break;
  }
}

const entry = lines.slice(startIndex, endIndex).join('\n').trim();
if (!entry) {
  console.error(`[mcp-extract-changelog] changelog entry for ${version} is empty`);
  process.exit(1);
}

process.stdout.write(`${entry}\n`);
