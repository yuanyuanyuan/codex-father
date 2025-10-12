import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export type InstallResult = {
  installed: boolean;
  destRoot: string;
  jobShPath: string;
  startShPath: string;
  manifestPath: string;
  runtimeVersion: string;
  updatedFiles: string[];
  removedFiles: string[];
  skippedFiles: string[];
};

function ensureDir(p: string): void {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
}

type RuntimeManifest = {
  version: string;
  files: Record<string, { hash: string }>;
};

const require = createRequire(import.meta.url);

function normalizeRelative(root: string, target: string): string {
  return path.relative(root, target).split(path.sep).join('/');
}

function hashFile(filePath: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function collectFiles(root: string, base = root): string[] {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const abs = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(abs, base));
      continue;
    }
    if (entry.isFile()) {
      files.push(normalizeRelative(base, abs));
    }
  }
  return files;
}

function readManifest(manifestPath: string): RuntimeManifest | null {
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  try {
    const content = fs.readFileSync(manifestPath, 'utf8');
    const parsed = JSON.parse(content) as RuntimeManifest;
    if (!parsed || typeof parsed.version !== 'string' || typeof parsed.files !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeManifest(manifestPath: string, manifest: RuntimeManifest): void {
  ensureDir(path.dirname(manifestPath));
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
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
  // Locate runtime assets robustly for both src (tsx/dev) and dist (tsc build) layouts:
  //  - dev/src:   <pkg>/src/utils -> <pkg>/src/assets/runtime
  //  - dist/tsc:  <pkg>/dist/utils -> prefer <pkg>/assets/runtime (published files),
  //               fall back to <pkg>/dist/assets/runtime if present
  const require = createRequire(import.meta.url);
  let assetsRootCandidates: string[] = [];
  try {
    const pkgJsonPath = require.resolve('../../package.json');
    const pkgDir = path.dirname(pkgJsonPath);
    assetsRootCandidates = [
      path.resolve(__dirname, '..', '..', 'assets', 'runtime'), // src layout
      path.resolve(pkgDir, 'assets', 'runtime'),                // package root assets (published)
      path.resolve(__dirname, '..', '..', '..', 'assets', 'runtime'), // fallback: dist -> pkg root
      path.resolve(__dirname, '..', '..', 'assets', 'runtime'), // fallback: dist local assets
    ];
  } catch {
    assetsRootCandidates = [
      path.resolve(__dirname, '..', '..', 'assets', 'runtime'),
      path.resolve(__dirname, '..', '..', '..', 'assets', 'runtime'),
    ];
  }
  const assetsRoot = assetsRootCandidates.find((p) => {
    try { return fs.existsSync(p); } catch { return false; }
  }) || path.resolve(__dirname, '..', '..', 'assets', 'runtime');
  const manifestPath = path.join(destRoot, '.runtime-manifest.json');
  const pkg = require('../../package.json') as { version?: string };
  const runtimeVersion = pkg.version || '0.0.0';

  let installed = false;
  const updatedFiles: string[] = [];
  const removedFiles: string[] = [];
  const skippedFiles: string[] = [];

  try {
    ensureDir(destRoot);
    const assetFiles = collectFiles(assetsRoot);
    const nextManifest: RuntimeManifest = {
      version: runtimeVersion,
      files: {},
    };
    const prevManifest = readManifest(manifestPath);
    const managedPaths = new Set(assetFiles);

    for (const relative of assetFiles) {
      const src = path.join(assetsRoot, relative);
      const dst = path.join(destRoot, relative);
      const srcHash = hashFile(src);
      nextManifest.files[relative] = { hash: srcHash };

      const dstExists = fs.existsSync(dst);
      if (!dstExists) {
        ensureDir(path.dirname(dst));
        fs.copyFileSync(src, dst);
        updatedFiles.push(relative);
        installed = true;
        continue;
      }

      const dstHash = hashFile(dst);
      if (dstHash === srcHash) {
        continue;
      }

      const prevHash = prevManifest?.files?.[relative]?.hash;
      if (prevHash && prevHash === dstHash) {
        ensureDir(path.dirname(dst));
        fs.copyFileSync(src, dst);
        updatedFiles.push(relative);
        installed = true;
        continue;
      }

      // Detected manual edits; do not clobber but record for logging.
      skippedFiles.push(relative);
    }

    if (prevManifest) {
      for (const relative of Object.keys(prevManifest.files)) {
        if (managedPaths.has(relative)) {
          continue;
        }
        const dst = path.join(destRoot, relative);
        if (!fs.existsSync(dst)) {
          continue;
        }
        const dstHash = hashFile(dst);
        if (prevManifest.files[relative]?.hash === dstHash) {
          fs.rmSync(dst);
          removedFiles.push(relative);
          installed = true;
        }
      }
    }

    writeManifest(manifestPath, nextManifest);

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
    manifestPath,
    runtimeVersion,
    updatedFiles,
    removedFiles,
    skippedFiles,
  };
}
