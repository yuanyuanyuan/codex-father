#!/usr/bin/env node

import { Command } from 'commander';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import CLI module
try {
  const { program } = await import(join(__dirname, 'cli/index.js'));

  // Default to MCP mode if no arguments provided
  if (process.argv.length <= 2) {
    process.argv.push('mcp');
  }

  // Parse command line arguments
  program.parse();
} catch (error) {
  console.error('❌ Failed to load Codex Father CLI:', error);
  process.exit(1);
}
