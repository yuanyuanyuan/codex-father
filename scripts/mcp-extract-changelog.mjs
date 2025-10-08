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
  // fallback to Unreleased or minimal notes when entry is missing
  let unreleasedStart=-1;
  const unreleasedRe=/^##\s*\[?Unreleased\]?/i;
  for(let i=0;i<lines.length;i+=1){if(unreleasedRe.test(lines[i])){unreleasedStart=i;break;}}
  if(unreleasedStart!==-1){
    let unreleasedEnd=lines.length;
    for(let i=unreleasedStart+1;i<lines.length;i+=1){if(/^##\s/.test(lines[i])){unreleasedEnd=i;break;}}
    const unreleasedEntry=lines.slice(unreleasedStart,unreleasedEnd).join('\n').trim();
    if(unreleasedEntry){
      const rewritten=unreleasedEntry.replace(unreleasedRe,`## [${version}]`);
      process.stdout.write(`${rewritten}\n\n> Notes auto-generated from Unreleased due to missing explicit entry for ${version}.\n`);
      process.exit(0);
    }
  }
  process.stdout.write(`## [${version}]\n\n_No curated changelog entry found. This release notes was auto-generated._\n`);
  process.exit(0);
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
