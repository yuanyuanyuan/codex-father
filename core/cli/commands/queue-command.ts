import type { CLIParser } from '../parser.js';
import type { CommandContext, CommandResult } from '../../lib/types.js';
import { QueueIntegrityChecker } from '../../lib/queue/integrity-checker.js';
import { QueueBackupManager } from '../../lib/queue/backup-restore.js';
import { QueueMonitor } from '../../lib/queue/monitor.js';
import { QueueOptimizer } from '../../lib/queue/optimizer.js';
import { QueueConfigManager } from '../../lib/queue/config-manager.js';
import { ensureQueueStructure } from '../../lib/queue/tools.js';

export function registerQueueCommand(parser: CLIParser): void {
  parser.registerCommand(
    'queue',
    'Manage task queue: integrity, backup, monitor, optimize, config',
    async (context: CommandContext): Promise<CommandResult> => {
      const action = context.args[0];
      const arg1 = context.args[1];
      const started = Date.now();
      const queueDir = ensureQueueStructure(context.workingDirectory).base;

      try {
        switch (action) {
          case 'check': {
            const checker = new QueueIntegrityChecker(queueDir);
            const res = await checker.check();
            return context.json
              ? { success: res.valid, data: res, executionTime: Date.now() - started }
              : {
                  success: res.valid,
                  message: res.summary,
                  data: context.verbose ? res : undefined,
                  executionTime: Date.now() - started,
                };
          }
          case 'backup': {
            if (!arg1) {
              return {
                success: false,
                message: 'backup path is required',
                errors: ['Provide file path'],
                executionTime: Date.now() - started,
              };
            }
            const b = new QueueBackupManager(queueDir);
            const res = await b.createBackup(arg1);
            return context.json
              ? { success: res.success, data: res, executionTime: Date.now() - started }
              : {
                  success: res.success,
                  message: `Backup created at ${res.backupPath}`,
                  data: context.verbose ? res : undefined,
                  executionTime: Date.now() - started,
                };
          }
          case 'restore': {
            if (!arg1) {
              return {
                success: false,
                message: 'manifest path is required',
                errors: ['Provide manifest path'],
                executionTime: Date.now() - started,
              };
            }
            const b = new QueueBackupManager(queueDir);
            const res = await b.restoreFromBackup(arg1, queueDir);
            return {
              success: res.success,
              data: context.json ? res : undefined,
              message: res.success ? 'Restore completed' : 'Restore failed',
              executionTime: Date.now() - started,
            };
          }
          case 'monitor': {
            const m = new QueueMonitor(queueDir);
            const res = await m.collect(new QueueConfigManager(queueDir).load());
            return context.json
              ? { success: true, data: res, executionTime: Date.now() - started }
              : {
                  success: true,
                  message: `Alerts: ${res.alerts.join(', ') || 'none'}`,
                  data: context.verbose ? res : undefined,
                  executionTime: Date.now() - started,
                };
          }
          case 'optimize': {
            const o = new QueueOptimizer(queueDir);
            const res = await o.optimize();
            return context.json
              ? { success: true, data: res, executionTime: Date.now() - started }
              : {
                  success: true,
                  message: `Indexed ${res.indexed}, potential savings ${res.savingsBytes}B`,
                  data: context.verbose ? res : undefined,
                  executionTime: Date.now() - started,
                };
          }
          case 'config': {
            const cm = new QueueConfigManager(queueDir);
            const cfg = cm.load();
            const val = cm.validate(cfg);
            return context.json
              ? {
                  success: val.valid,
                  data: { cfg, validation: val },
                  executionTime: Date.now() - started,
                }
              : {
                  success: val.valid,
                  message: `Config valid: ${val.valid}`,
                  data: context.verbose ? { cfg, validation: val } : undefined,
                  executionTime: Date.now() - started,
                };
          }
          default:
            return {
              success: false,
              message: `Unknown queue action: ${action ?? ''}`.trim(),
              errors: [
                'Supported: check, backup <file>, restore <manifest>, monitor, optimize, config',
              ],
              executionTime: Date.now() - started,
            };
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          message: 'Queue command failed',
          errors: [errorMessage],
          executionTime: Date.now() - started,
        };
      }
    },
    {
      arguments: [
        {
          name: 'action',
          description: 'Queue action (check|backup|restore|monitor|optimize|config)',
          required: true,
        },
        { name: 'arg', description: 'Action argument (e.g., backup path)', required: false },
      ],
    }
  );
}
