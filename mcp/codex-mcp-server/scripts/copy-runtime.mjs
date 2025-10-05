#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function ensureDir(p) {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
}

function cpRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    ensureDir(dest);
    for (const entry of fs.readdirSync(src)) {
      cpRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
  }
}

// package dir: mcp/codex-mcp-server
const __filename = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(__filename);
const pkgDir = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(pkgDir, '..', '..');
const assetsRoot = path.resolve(pkgDir, 'assets', 'runtime');

const sources = [
  { src: path.join(repoRoot, 'job.sh'), dst: path.join(assetsRoot, 'job.sh') },
  { src: path.join(repoRoot, 'start.sh'), dst: path.join(assetsRoot, 'start.sh') },
  { src: path.join(repoRoot, 'job.d'), dst: path.join(assetsRoot, 'job.d') },
  { src: path.join(repoRoot, 'start.d'), dst: path.join(assetsRoot, 'start.d') },
  { src: path.join(repoRoot, 'lib'), dst: path.join(assetsRoot, 'lib') },
];

let copied = 0;
for (const { src, dst } of sources) {
  if (!fs.existsSync(src)) {
    console.warn(`[copy-runtime] missing source: ${src}`);
    continue;
  }
  cpRecursive(src, dst);
  copied++;
}

if (copied === 0) {
  console.warn('[copy-runtime] no runtime files were copied');
} else {
  console.log(`[copy-runtime] runtime files copied to ${assetsRoot}`);
}
