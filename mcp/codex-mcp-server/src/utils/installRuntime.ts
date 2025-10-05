import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type InstallResult = {
  installed: boolean;
  destRoot: string;
  jobShPath: string;
  startShPath: string;
};

function ensureDir(p: string) {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
}

function copyRecursive(src: string, dest: string) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    ensureDir(dest);
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    // Only copy if target doesn't exist to avoid clobbering user's local edits
    if (!fs.existsSync(dest)) {
      ensureDir(path.dirname(dest));
      fs.copyFileSync(src, dest);
    }
  }
}

/**
 * Ensure embedded runtime scripts (job.sh/start.sh + deps) are available
 * under `<projectRoot>/.codex-father`. If not present, copy from package assets.
 */
export function ensureEmbeddedRuntime(projectRoot: string): InstallResult {
  const destRoot = path.resolve(projectRoot, '.codex-father');
  const destJob = path.join(destRoot, 'job.sh');
  const destStart = path.join(destRoot, 'start.sh');
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const assetsRoot = path.resolve(__dirname, '..', '..', 'assets', 'runtime');

  let installed = false;
  try {
    const required = [
      'job.sh',
      'start.sh',
      path.join('job.d'),
      path.join('start.d'),
      path.join('lib'),
    ];

    // If both top-level launchers exist already, we still ensure subfolders exist
    ensureDir(destRoot);
    for (const seg of required) {
      const src = path.join(assetsRoot, seg);
      const dst = path.join(destRoot, seg);
      if (!fs.existsSync(src)) {
        // Assets not bundled; skip silently and allow upstream fallback
        continue;
      }
      const before = fs.existsSync(dst);
      copyRecursive(src, dst);
      const after = fs.existsSync(dst);
      if (!before && after) {
        installed = true;
      }
    }

    // Make launchers executable if present
    if (fs.existsSync(destJob)) {
      try {
        fs.chmodSync(destJob, 0o755);
      } catch {
        /* ignore */
      }
    }
    if (fs.existsSync(destStart)) {
      try {
        fs.chmodSync(destStart, 0o755);
      } catch {
        /* ignore */
      }
    }
  } catch {
    // Best effort; any failure will be handled by outer fallback
  }

  return {
    installed,
    destRoot,
    jobShPath: destJob,
    startShPath: destStart,
  };
}
