#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const followupPath = path.join(root, 'specs', 'archive-checklist-followup-tasks.md');
const statusPath = path.join(root, 'specs', 'archive-requirements-checklist-status.md');

function parseTasks(md) {
  const lines = md.split(/\r?\n/);
  const tasks = [];
  let cur = null;
  for (const line of lines) {
    const m = line.match(/^\- \*\*(T\d{3})\*\*/);
    if (m) {
      if (cur) {tasks.push(cur);}
      cur = { id: m[1], status: '未知', raw: [line] };
      continue;
    }
    if (cur) {
      cur.raw.push(line);
      const s = line.match(/^\s*\- \*\*Status\*\*:\s*(.+?)\s*$/);
      if (s) {cur.status = s[1];}
      const l = line.match(/^\s*\- \*\*Links\*\*:\s*(.+?)\s*$/);
      if (l) {
        const chks = Array.from(String(l[1]).matchAll(/CHK\s*0*(\d+)/gi)).map((m) => `CHK${m[1].padStart(3, '0')}`);
        cur.links = chks;
      }
    }
  }
  if (cur) {tasks.push(cur);}
  return tasks;
}

function parseChkStatus(md) {
  const lines = md.split(/\r?\n/);
  const map = new Map();
  for (const line of lines) {
    const m = line.match(/\b(CHK\d{3})\s*(已实现|未实现|部分实现)/);
    if (m) {
      map.set(m[1], m[2]);
    }
  }
  return map;
}

async function main() {
  const followup = await fs.readFile(followupPath, 'utf-8');
  const tasks = parseTasks(followup);
  const statusExists = await fs
    .access(statusPath)
    .then(() => true)
    .catch(() => false);

  const chkMap = statusExists ? parseChkStatus(await fs.readFile(statusPath, 'utf-8')) : new Map();

  const summary = {
    source: path.relative(root, followupPath),
    mirrored: statusExists ? path.relative(root, statusPath) : null,
    total: tasks.length,
    done: tasks.filter((t) => /已完成/.test(t.status)).length,
    inProgress: tasks.filter((t) => /进行中/.test(t.status)).length,
    todo: tasks.filter((t) => /待启动|待处理|未开始/.test(t.status)).length,
    items: tasks.map((t) => ({ id: t.id, status: t.status, links: t.links ?? [] })),
  };

  // 规则：
  // - 任务“已完成” → 所有链接的 CHK 应为“已实现”（否则 mismatch）
  // - 任务“进行中” → 链接 CHK 允许 “部分实现/未实现”（不算 mismatch）
  // - 任务“待启动” → 链接 CHK 可为 未实现/部分实现（不算 mismatch）
  const mismatches = [];
  for (const t of tasks) {
    const status = t.status || '';
    if (!/已完成/.test(status)) {continue;}
    const links = Array.isArray(t.links) ? t.links : [];
    for (const chk of links) {
      const s = chkMap.get(chk);
      if (s && s !== '已实现') {
        mismatches.push({ task: t.id, chk, chkStatus: s });
      }
    }
  }
  summary.mismatches = mismatches;

  const strict = process.argv.includes('--strict') || process.env.CHECKLIST_STRICT === '1';
  console.log(JSON.stringify({ status: 'ok', data: summary }, null, 2));

  if (strict && (summary.todo > 0 || (summary.mismatches ?? []).length > 0)) {
    const level = Number.parseInt(process.env.CHECKLIST_STRICT_LEVEL ?? '1', 10);
    if ((summary.mismatches ?? []).length > 0) {
      console.error('[checklist-sync] 警告：发现任务/CHK 状态不一致：');
      for (const m of summary.mismatches) {
        console.error(`  - ${m.task} 链接 ${m.chk} 当前为 ${m.chkStatus}（期望：已实现）`);
      }
    }
    if (summary.todo > 0) {
      console.error(`[checklist-sync] 提醒：存在待启动任务 ${summary.todo} 项。`);
    }
    if (level >= 2 && (summary.mismatches ?? []).length > 0) {
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error('[checklist-sync] 运行失败:', err?.message || String(err));
  process.exit(2);
});
