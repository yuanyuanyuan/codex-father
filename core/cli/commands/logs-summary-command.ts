import type { CLIParser } from '../parser.js';
import type { CommandResult } from '../../lib/types.js';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { resolveSessionDir, resolveEventsPath as resolveEventsById } from '../../lib/paths.js';
import * as readline from 'node:readline';

type SummaryOptions = {
  output?: string;
  text?: boolean | string;
};

function toOptions(raw: Record<string, unknown> | undefined): SummaryOptions {
  const out: SummaryOptions = {};
  if (!raw) {
    return out;
  }
  if (typeof raw.output === 'string') {
    out.output = raw.output.trim();
  }
  if (typeof raw.text === 'boolean' || typeof raw.text === 'string') {
    out.text = raw.text;
  }
  return out;
}

// 使用统一路径工具（支持环境变量覆盖）

async function readEvents(filePath: string): Promise<Record<string, unknown>[]> {
  const events: Record<string, unknown>[] = [];
  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    stream.on('error', reject);
    rl.on('line', (line) => {
      if (!line) {
        return;
      }
      try {
        const obj = JSON.parse(line) as Record<string, unknown>;
        events.push(obj);
      } catch {
        // skip invalid lines
      }
    });
    rl.on('close', () => resolve());
  });
  return events;
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}
function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? (v as number) : undefined;
}

export function registerLogsSummaryCommand(parser: CLIParser): void {
  parser.registerCommand(
    'logs:summary',
    '基于 events.jsonl 生成会话摘要（适用于 job/start.sh 会话）',
    async (context) => {
      const start = Date.now();
      const sessionId = String(context.args[0] ?? '').trim();
      if (!sessionId) {
        return {
          success: false,
          message: '请提供 sessionId',
          exitCode: 2,
          executionTime: Date.now() - start,
        } satisfies CommandResult;
      }

      const options = toOptions(context.options);
      const eventsPath = resolveEventsById(sessionId);
      try {
        await fsp.access(eventsPath, fs.constants.F_OK | fs.constants.R_OK);
      } catch (error) {
        const msg = `未找到 events.jsonl: ${eventsPath}`;
        return {
          success: false,
          message: msg,
          errors: [msg],
          exitCode: 3,
          executionTime: Date.now() - start,
        } satisfies CommandResult;
      }

      const events = await readEvents(eventsPath);
      const counts: Record<string, number> = {};
      let firstTs: string | undefined;
      let lastTs: string | undefined;
      let completed: Record<string, unknown> | undefined;
      let lastInstr: Record<string, unknown> | undefined;
      for (const e of events) {
        const type = asString(e.event) ?? asString((e as any).type) ?? 'unknown';
        counts[type] = (counts[type] ?? 0) + 1;
        const ts = asString(e.timestamp);
        if (ts) {
          if (!firstTs) {
            firstTs = ts;
          }
          lastTs = ts;
        }
        if (type === 'orchestration_completed') {
          completed = e;
        }
        if (type === 'instructions_updated') {
          lastInstr = e;
        }
      }

      const data = (completed?.data as Record<string, unknown>) ?? {};
      const status = asString(data.status) ?? 'unknown';
      const exitCode = asNumber(data.exitCode);
      const successRate = asNumber(data.successRate);
      const completedTasks = asNumber(data.completedTasks);
      const failedTasks = asNumber(data.failedTasks);
      const classification = asString(data.classification);

      const payload: Record<string, unknown> = {
        sessionId,
        eventsFile: eventsPath,
        status,
        ...(exitCode !== undefined ? { exitCode } : {}),
        ...(classification ? { classification } : {}),
        ...(successRate !== undefined ? { successRate } : {}),
        ...(completedTasks !== undefined ? { completedTasks } : {}),
        ...(failedTasks !== undefined ? { failedTasks } : {}),
        timestamps: {
          first: firstTs,
          last: lastTs,
          totalMs:
            firstTs && lastTs ? Math.max(0, Date.parse(lastTs) - Date.parse(firstTs)) : undefined,
        },
        counts,
      };

      if (lastInstr && typeof lastInstr === 'object') {
        const d = (lastInstr.data as Record<string, unknown>) ?? {};
        payload.lastInstructions = {
          path: asString(d.path),
          sha256: asString(d.sha256),
          lines: asNumber(d.lines),
          added: asNumber(d.added),
          removed: asNumber(d.removed),
          timestamp: asString(lastInstr.timestamp),
        };
      }

      // 输出位置：默认写入 <session>/report.summary.json
      const sessionDir = resolveSessionDir(sessionId);
      const outputPath = options.output
        ? path.resolve(String(options.output))
        : path.join(sessionDir, 'report.summary.json');
      try {
        await fsp.mkdir(path.dirname(outputPath), { recursive: true, mode: 0o700 });
        await fsp.writeFile(outputPath, JSON.stringify(payload, null, 2), {
          encoding: 'utf-8',
          mode: 0o600,
        });
      } catch (error) {
        const msg = `写入摘要失败: ${(error as Error).message}`;
        return {
          success: false,
          message: msg,
          errors: [msg],
          exitCode: 5,
          executionTime: Date.now() - start,
        } satisfies CommandResult;
      }

      const result: CommandResult = {
        success: true,
        data: { sessionId, eventsFile: eventsPath, outputPath, summary: payload },
        executionTime: Date.now() - start,
      };
      if (!context.json) {
        if (options.text === true || options.text === 'true') {
          const lines: string[] = [];
          lines.push(`status: ${status}`);
          if (exitCode !== undefined) {
            lines.push(`exit: ${exitCode}`);
          }
          if (classification) {
            lines.push(`class: ${classification}`);
          }
          if (successRate !== undefined) {
            lines.push(`successRate: ${successRate}`);
          }
          lines.push(`events: ${eventsPath}`);
          lines.push(`written: ${outputPath}`);
          result.message = lines.join('\n');
        } else {
          result.message = `摘要已写入 ${outputPath}`;
        }
      }
      return result;
    },
    {
      usage: '<sessionId> [options]',
      arguments: [
        { name: 'sessionId', description: '会话 ID (.codex-father/sessions/<id>)', required: true },
      ],
      options: [
        { flags: '--output <path>', description: '将摘要写入到指定路径（默认写入会话目录）' },
        { flags: '--text', description: '以简短文本预览关键信息', defaultValue: false },
      ],
    }
  );
}
