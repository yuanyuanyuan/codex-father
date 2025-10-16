export class ConcurrencyManager {
  private running: Set<string> = new Set();
  private maxConcurrency: number;

  constructor(maxConcurrency: number = 10) {
    this.maxConcurrency = maxConcurrency;
  }

  canAcquireSlot(): boolean {
    return this.running.size < this.maxConcurrency;
  }

  acquireSlot(taskId: string): void {
    if (!this.canAcquireSlot()) {
      throw new Error('Maximum concurrency reached');
    }
    this.running.add(taskId);
  }

  releaseSlot(taskId: string): void {
    this.running.delete(taskId);
  }

  getRunningCount(): number {
    return this.running.size;
  }

  getMaxConcurrency(): number {
    return this.maxConcurrency;
  }

  cancelTask(taskId: string): boolean {
    if (this.running.has(taskId)) {
      this.running.delete(taskId);
      return true;
    }
    return false;
  }

  getRunningTasks(): string[] {
    return Array.from(this.running);
  }

  adjustConcurrency(newMax: number): void {
    this.maxConcurrency = Math.max(1, newMax);
  }
}
