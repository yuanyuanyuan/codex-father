import { TaskResult, SystemState } from './types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export class JsonStorage {
  private dataPath: string;
  private state: SystemState;

  constructor(dataPath?: string) {
    this.dataPath = dataPath || path.join(process.cwd(), '.codex-father-state.json');
    this.state = this.initializeState();
  }

  private initializeState(): SystemState {
    return {
      tasks: {
        running: [],
        completed: [],
        results: {},
      },
      sessions: {},
      config: {
        maxConcurrency: 10,
        defaultTimeout: 600000,
        security: {
          networkDisabled: true,
          allowedPaths: [process.cwd()],
        },
      },
    };
  }

  async saveResult(result: TaskResult): Promise<void> {
    const key = result.taskId;
    this.state.tasks.results[key] = result;

    if (result.success) {
      if (!this.state.tasks.completed.includes(key)) {
        this.state.tasks.completed.push(key);
      }
    }

    await this.atomicWrite(this.dataPath, this.state);
  }

  getResult(taskId: string): TaskResult | undefined {
    return this.state.tasks.results[taskId];
  }

  getCompletedCount(): number {
    return this.state.tasks.completed.length;
  }

  async loadState(): Promise<SystemState> {
    try {
      const data = await fs.readFile(this.dataPath, 'utf-8');
      this.state = JSON.parse(data);
    } catch (error) {
      // File doesn't exist or is corrupted, start fresh
      this.state = this.initializeState();
      await this.atomicWrite(this.dataPath, this.state);
    }
    return this.state;
  }

  private async atomicWrite(filePath: string, data: any): Promise<void> {
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tempPath = `${filePath}.${uniqueSuffix}.tmp`;
    const jsonStr = JSON.stringify(data, null, 2);

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(tempPath, jsonStr, 'utf-8');
    await fs.rename(tempPath, filePath);
  }

  async clearOldResults(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
    const cutoff = Date.now() - maxAge;
    const toRemove: string[] = [];

    for (const [taskId, result] of Object.entries(this.state.tasks.results)) {
      if (result.endTime.getTime() < cutoff) {
        toRemove.push(taskId);
      }
    }

    toRemove.forEach((taskId) => {
      delete this.state.tasks.results[taskId];
      const index = this.state.tasks.completed.indexOf(taskId);
      if (index !== -1) {
        this.state.tasks.completed.splice(index, 1);
      }
    });

    if (toRemove.length > 0) {
      await this.atomicWrite(this.dataPath, this.state);
    }
  }
}
