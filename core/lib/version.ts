import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let packageName: string | undefined;
let packageVersion: string | undefined;

try {
  const pkg = require('../../package.json') as { name?: string; version?: string };
  packageName = pkg.name;
  packageVersion = pkg.version;
} catch {
  packageName = undefined;
  packageVersion = undefined;
}

export const PROJECT_NAME = process.env.npm_package_name ?? packageName ?? 'codex-father';
export const PROJECT_VERSION = process.env.npm_package_version ?? packageVersion ?? '1.5.1';
