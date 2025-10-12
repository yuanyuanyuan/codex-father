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
const repo = process.env.GITHUB_REPOSITORY || '';
const href = repo ? `https://github.com/${repo}/blob/main/mcp/codex-mcp-server/CHANGELOG.md` : 'mcp/codex-mcp-server/CHANGELOG.md';
const headingPattern = new RegExp(`^#{2,3}\\s*\\[?${version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]?`);
let startIndex = -1;
for (let i = 0; i < lines.length; i += 1) {
  if (headingPattern.test(lines[i])) {
    startIndex = i;
    break;
  }
}

if (startIndex === -1) {
  // Strict mode by default: do NOT allow leaking Unreleased into release notes
  // Allow explicit override via ALLOW_UNRELEASED_FALLBACK=1|true|yes
  const allowEnv = String(process.env.ALLOW_UNRELEASED_FALLBACK || '').trim();
  const allowFallback = /^(1|true|yes)$/i.test(allowEnv);
  if (!allowFallback) {
    console.error(`[mcp-extract-changelog] missing explicit changelog entry for ${version}.`);
    console.error('[mcp-extract-changelog] Refusing to auto-generate from [Unreleased] or minimal template.');
    console.error('[mcp-extract-changelog] Please add a "## [' + version + ']" section to mcp/codex-mcp-server/CHANGELOG.md');
    console.error('[mcp-extract-changelog] or set ALLOW_UNRELEASED_FALLBACK=1 to bypass (not recommended).');
    process.exit(1);
  }

  // Fallback path (explicitly allowed): use Unreleased when available; otherwise minimal
  let unreleasedStart = -1;
  const unreleasedRe = /^##\s*\[?Unreleased\]?/i;
  for (let i = 0; i < lines.length; i += 1) {
    if (unreleasedRe.test(lines[i])) { unreleasedStart = i; break; }
  }
  if (unreleasedStart !== -1) {
    let unreleasedEnd = lines.length;
    for (let i = unreleasedStart + 1; i < lines.length; i += 1) {
      if (/^##\s/.test(lines[i])) { unreleasedEnd = i; break; }
    }
    const unreleasedEntry = lines.slice(unreleasedStart, unreleasedEnd).join('\n').trim();
    if (unreleasedEntry) {
      const rewritten = unreleasedEntry.replace(unreleasedRe, `## [${version}]`);
      process.stdout.write(`${rewritten}\n\n> Notes auto-generated from Unreleased due to missing explicit entry for ${version}.\n\nSee also: [CHANGELOG](${href})\n`);
      process.exit(0);
    }
  }
  process.stdout.write(`## [${version}]\n\n_No curated changelog entry found. This release notes was auto-generated (fallback allowed).\n\nSee also: [CHANGELOG](${href})\n`);
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

process.stdout.write(`${entry}\n\nSee also: [CHANGELOG](${href})\n`);
