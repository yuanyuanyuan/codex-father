import { TaskScheduler } from './scheduler.js';
import { RetryManager } from './retry-manager.js';
import { QueueMonitor } from './monitor.js';
import { QueueIntegrityChecker } from './integrity-checker.js';
import { QueueBackupManager } from './backup-restore.js';
import { QueueOptimizer } from './optimizer.js';
import { QueueConfigManager } from './config-manager.js';
import { TaskQueueAPI } from './api.js';

export interface QueueSystem {
  api: TaskQueueAPI;
  scheduler: TaskScheduler;
  retries: RetryManager;
  monitor: QueueMonitor;
  integrity: QueueIntegrityChecker;
  backup: QueueBackupManager;
  optimizer: QueueOptimizer;
  config: QueueConfigManager;
}

export function createQueueSystem(queuePath?: string): QueueSystem {
  return {
    api: new TaskQueueAPI(queuePath),
    scheduler: new TaskScheduler({ queuePath }),
    retries: new RetryManager({ queuePath }),
    monitor: new QueueMonitor(queuePath),
    integrity: new QueueIntegrityChecker(queuePath),
    backup: new QueueBackupManager(queuePath),
    optimizer: new QueueOptimizer(queuePath),
    config: new QueueConfigManager(queuePath),
  };
}
