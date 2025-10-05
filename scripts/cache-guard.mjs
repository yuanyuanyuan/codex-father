#!/usr/bin/env node
// Cache Guard: auto-cleans caches when config or toolchain changes
// Node >= 18 required
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

const cwd = process.cwd();
const stateDir = path.join(cwd, '.codex-father');
const stateFile = path.join(stateDir, 'cache-hash.json');
const force = process.argv.includes('--force');

const filesToHash = [
  'package.json',
  'package-lock.json',
  'eslint.config.js',
  'tsconfig.json',
  'tsconfig.build.json',
  'tsconfig.eslint.json',
  'vitest.config.ts',
  '.prettierignore',
  '.prettierrc',
].map((p) => path.join(cwd, p));

const caches = [
  '.cache/eslint',
  '.tsbuildinfo',
  '.tsbuildinfo.build',
  '.tsbuildinfo.eslint',
  'coverage',
  '.nyc_output',
  'node_modules/.vite',
  'vitest-temp',
];

function safeRead(file) {
  try {
    return fs.readFileSync(file);
  } catch {
    return Buffer.alloc(0);
  }
}

function computeHash() {
  const hash = createHash('sha256');
  for (const f of filesToHash) {
    hash.update(f);
    hash.update(safeRead(f));
  }
  // include key devDependencies versions to invalidate on upgrades
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
    const keys = [
      'eslint',
      '@typescript-eslint/eslint-plugin',
      '@typescript-eslint/parser',
      'typescript',
      'vitest',
      'prettier',
    ];
    const versions = keys.reduce((acc, k) => {
      acc[k] = pkg.devDependencies?.[k] || pkg.dependencies?.[k] || '';
      return acc;
    }, /** @type {Record<string,string>} */ ({}));
    hash.update(JSON.stringify(versions));
  } catch {
    // ignore
  }
  return hash.digest('hex');
}

function rmrf(p) {
  const full = path.join(cwd, p);
  if (!fs.existsSync(full)) {
    return;
  }
  fs.rmSync(full, { recursive: true, force: true });
}

function ensureDir(p) {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
}

function loadPrev() {
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch {
    return { hash: '' };
  }
}

function save(hash) {
  ensureDir(stateDir);
  fs.writeFileSync(stateFile, JSON.stringify({ hash }, null, 2));
}

function cleanAll() {
  for (const c of caches) {
    rmrf(c);
  }
}

const current = computeHash();
const prev = loadPrev();

if (force) {
  console.log('[cache-guard] Force cleaning caches...');
  cleanAll();
  save(current);
  process.exit(0);
}

if (prev.hash !== current) {
  console.log('[cache-guard] Detected config/toolchain change. Cleaning caches...');
  cleanAll();
  save(current);
} else {
  console.log('[cache-guard] Cache is fresh. Skipping clean.');
}
