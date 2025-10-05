#!/usr/bin/env node
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

const requiredArtifacts = [
  'dist/index.js',
  'dist/config/env.js',
  'dist/logger.js',
];

async function verify() {
  const missing = [];
  for (const relative of requiredArtifacts) {
    const absolute = path.resolve(process.cwd(), relative);
    try {
      await access(absolute, constants.R_OK);
    } catch (error) {
      missing.push(relative);
    }
  }

  if (missing.length) {
    process.stderr.write(
      `Missing build artifacts before publish: ${missing.join(', ')}\n` +
        'Run `npm run build` and retry.\n'
    );
    process.exit(1);
  }
}

verify().catch((error) => {
  process.stderr.write(`Failed to verify build artifacts: ${error}\n`);
  process.exit(1);
});
