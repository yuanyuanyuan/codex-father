import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type ResolvedExecutable = {
  path: string;
  exists: boolean;
};

export type ResolvedPaths = {
  projectRoot: string;
  jobSh: ResolvedExecutable;
  startSh: ResolvedExecutable;
};

function dedupe<T>(values: T[]): T[] {
  const seen = new Set<T>();
  const result: T[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  return result;
}

function candidateRoots(): string[] {
  const envRoot =
    process.env.CODEX_MCP_PROJECT_ROOT ||
    process.env.CODEX_PROJECT_ROOT ||
    process.env.PROJECT_ROOT;
  const cwd = process.cwd();
  const roots: string[] = [];
  if (envRoot && envRoot.trim()) {
    roots.push(path.resolve(envRoot.trim()));
  }
  roots.push(cwd);
  roots.push(path.resolve(cwd, '..'));
  roots.push(path.resolve(cwd, '../..'));
  roots.push(path.resolve(__dirname, '../../../../'));
  roots.push(path.resolve(__dirname, '../../../../../'));
  return dedupe(roots.filter(Boolean));
}

function resolveExecutableFile(
  root: string,
  relative: string,
  envOverride?: string
): ResolvedExecutable {
  if (envOverride && envOverride.trim()) {
    const abs = path.resolve(envOverride.trim());
    return { path: abs, exists: fs.existsSync(abs) };
  }
  const abs = path.resolve(root, relative);
  return { path: abs, exists: fs.existsSync(abs) };
}

export function resolvePaths(): ResolvedPaths {
  const roots = candidateRoots();
  let projectRoot = roots[0];
  for (const root of roots) {
    const jobCandidate = path.resolve(root, 'job.sh');
    const jobCandidateAlt = path.resolve(root, '.codex-father', 'job.sh');
    if (fs.existsSync(jobCandidate) || fs.existsSync(jobCandidateAlt)) {
      projectRoot = root;
      break;
    }
  }

  const jobOverride = process.env.CODEX_JOB_SH;
  const startOverride = process.env.CODEX_START_SH;

  let jobSh = resolveExecutableFile(projectRoot, 'job.sh', jobOverride);
  let startSh = resolveExecutableFile(projectRoot, 'start.sh', startOverride);
  // Also accept scripts under .codex-father if top-level missing
  if (!jobSh.exists) {
    const alt = path.resolve(projectRoot, '.codex-father', 'job.sh');
    jobSh = { path: alt, exists: fs.existsSync(alt) };
  }
  if (!startSh.exists) {
    const alt = path.resolve(projectRoot, '.codex-father', 'start.sh');
    startSh = { path: alt, exists: fs.existsSync(alt) };
  }

  return {
    projectRoot,
    jobSh,
    startSh,
  };
}
