import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const STATUS_DIRECTORIES = [
    'pending',
    'scheduled',
    'processing',
    'retrying',
    'completed',
    'failed',
    'timeout',
    'cancelled',
];
const EXTRA_DIRS = ['logs', 'index', 'locks', 'tmp', 'archived'];
export function resolveQueuePath(base) {
    return resolve(base ?? join(process.cwd(), '.codex-father/queue'));
}
export function ensureQueueStructure(basePath) {
    const base = resolveQueuePath(basePath);
    if (!existsSync(base)) {
        mkdirSync(base, { recursive: true });
    }
    const statuses = {};
    for (const status of STATUS_DIRECTORIES) {
        const dirName = status === 'processing' ? 'running' : status;
        const dirPath = join(base, dirName);
        if (!existsSync(dirPath)) {
            mkdirSync(dirPath, { recursive: true });
        }
        statuses[status] = dirPath;
    }
    const tasks = {};
    for (const status of STATUS_DIRECTORIES) {
        const taskDir = join(statuses[status], 'tasks');
        if (!existsSync(taskDir)) {
            mkdirSync(taskDir, { recursive: true });
        }
        tasks[status] = taskDir;
    }
    const metadata = {};
    for (const status of STATUS_DIRECTORIES) {
        const metadataDir = join(statuses[status], 'metadata');
        if (!existsSync(metadataDir)) {
            mkdirSync(metadataDir, { recursive: true });
        }
        metadata[status] = metadataDir;
    }
    const extras = {};
    for (const dir of EXTRA_DIRS) {
        const dirPath = join(base, dir);
        if (!existsSync(dirPath)) {
            mkdirSync(dirPath, { recursive: true });
        }
        extras[dir] = dirPath;
    }
    const all = [
        base,
        ...Object.values(statuses),
        ...Object.values(tasks),
        ...Object.values(metadata),
        ...Object.values(extras),
    ];
    return {
        base,
        statuses,
        tasks,
        metadata,
        logs: extras.logs,
        index: extras.index,
        locks: extras.locks,
        tmp: extras.tmp,
        archived: extras.archived,
        all,
    };
}
export function readJSONSafe(path) {
    try {
        const raw = readFileSync(path, 'utf8');
        return { ok: true, value: JSON.parse(raw) };
    }
    catch (err) {
        return { ok: false, error: err?.message || 'read_failed' };
    }
}
export function now() {
    return new Date();
}
export function toIso(d) {
    return d ? new Date(d).toISOString() : undefined;
}
