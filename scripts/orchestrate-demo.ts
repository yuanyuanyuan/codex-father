import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StateManager } from '../core/orchestrator/state-manager.ts';
import { ProcessOrchestrator } from '../core/orchestrator/process-orchestrator.ts';
import type { TaskDefinition } from '../core/orchestrator/types.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type Pattern = 'chain' | 'independent';
type Backoff = 'fixed' | 'exponential';

function nowIso(): string {
  return new Date().toISOString();
}

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function toInt(v: string | undefined, def: number): number {
  const n = v ? Number.parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : def;
}

function toPattern(v: string | undefined): Pattern {
  return v === 'independent' ? 'independent' : 'chain';
}

function toBackoff(v: string | undefined): Backoff {
  return v === 'fixed' ? 'fixed' : 'exponential';
}

function makeTask(
  id: string,
  description: string,
  role: string,
  deps: string[] = [],
  simulateFailure = false
): TaskDefinition {
  return {
    id,
    title: undefined,
    description,
    role,
    mutation: false,
    roleMatchMethod: 'rule',
    roleMatchDetails: JSON.stringify({
      source: 'manual',
      command: `run-${id}`,
      logSnippet: `done-${id}`,
      simulateFailure,
    }),
    status: 'pending',
    dependencies: deps,
    priority: 0,
    timeout: 60_000,
    createdAt: nowIso(),
    outputs: [],
    attempts: 0,
  } as TaskDefinition;
}

function buildTasks(
  count: number,
  pattern: Pattern,
  failTarget: string | undefined
): TaskDefinition[] {
  const tasks: TaskDefinition[] = [];
  for (let i = 1; i <= count; i++) {
    const id = `t-${i}`;
    const role = i % 3 === 1 ? 'developer' : i % 3 === 2 ? 'reviewer' : 'tester';
    const deps: string[] = pattern === 'chain' && i > 1 ? [`t-${i - 1}`] : [];
    const simulate = failTarget === id || (failTarget === 'last' && i === count);
    tasks.push(makeTask(id, `Task ${i}`, role, deps, simulate));
  }
  return tasks;
}

function printUsage(): void {
  const lines = [
    'Usage: tsx scripts/orchestrate-demo.ts [options]',
    'Options:',
    '  --tasks <n>                 Number of tasks (default: 3)',
    '  --pattern <chain|independent>  Topology pattern (default: chain)',
    '  --concurrency <n>          Max concurrency (default: 2)',
    '  --retry-max <n>            Max retry attempts (default: 2)',
    '  --retry-backoff <fixed|exponential> (default: exponential)',
    '  --retry-initial-ms <n>     Initial backoff delay (default: 10)',
    '  --retry-max-ms <n>         Max backoff delay (default: 100)',
    '  --simulate-fail <task-id|last|none>  Simulate failure for target task (default: none)',
    '  --session-id <id>          Custom session id',
    '  --understanding <on|off>   Enable understanding gate (default: on)',
    '  --manual-require-ack <true|false>  Manual gate require ack (default: false)',
    '  --manual-ack <true|false>  Manual gate ack (default: false)',
    '  --help                     Show this help',
  ];
  process.stdout.write(lines.join('\n') + '\n');
}

async function main(): Promise<void> {
  if (hasFlag('--help')) {
    printUsage();
    return;
  }

  const tasksCount = toInt(getArg('--tasks'), 3);
  const pattern = toPattern(getArg('--pattern'));
  const concurrency = toInt(getArg('--concurrency'), 2);
  const retryMax = toInt(getArg('--retry-max'), 2);
  const retryInitial = toInt(getArg('--retry-initial-ms'), 10);
  const retryMaxMs = toInt(getArg('--retry-max-ms'), 100);
  const retryBackoff = toBackoff(getArg('--retry-backoff'));
  const simulateFail = (getArg('--simulate-fail') || 'none').trim();
  const understandingOn = (getArg('--understanding') || 'on') !== 'off';
  const manualRequireAck = (getArg('--manual-require-ack') || 'false') === 'true';
  const manualAck = (getArg('--manual-ack') || 'false') === 'true';

  const sessionId =
    (getArg('--session-id') || process.env.SESSION_ID || '').trim() || `orc_${randomUUID()}`;
  const sessionDir = path.join(process.cwd(), '.codex-father', 'sessions', sessionId);

  const stateManager = new StateManager({ orchestrationId: sessionId, sessionDir });

  const orchestrator = new ProcessOrchestrator({
    stateManager,
    sessionDir,
    maxConcurrency: concurrency,
    manualIntervention: {
      enabled: manualRequireAck || manualAck,
      requireAck: manualRequireAck,
      ack: manualAck,
    },
    understanding: understandingOn
      ? {
          requirement: `demo: run ${tasksCount} tasks with ${pattern}`,
          restatement: `run ${pattern === 'chain' ? 't-1..t-n sequentially' : 't-1..t-n in parallel'}`,
          evaluateConsistency: async () => ({ consistent: true, issues: [] }),
        }
      : undefined,
    retryPolicy: {
      maxAttempts: retryMax,
      backoff: retryBackoff as any,
      initialDelayMs: retryInitial,
      maxDelayMs: retryMaxMs,
    },
  } as any);

  await stateManager.emitEvent({ event: 'start', data: { sessionId } });

  const failTarget = simulateFail === 'none' ? undefined : simulateFail;
  const tasks: TaskDefinition[] = buildTasks(tasksCount, pattern, failTarget);

  await orchestrator.orchestrate(tasks);

  await stateManager.emitEvent({ event: 'orchestration_completed', data: { sessionId } });

  const eventsPath = path.join(sessionDir, 'events.jsonl');
  process.stdout.write(JSON.stringify({ sessionId, eventsPath }) + '\n');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
