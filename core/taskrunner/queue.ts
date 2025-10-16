import { TaskConfig } from './types.js';

export class TaskQueue {
  private queue: TaskConfig[] = [];
  private processing = false;

  enqueue(task: TaskConfig): void {
    // Insert based on priority
    const priority = task.priority || 'normal';
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    const taskPriority = priorityOrder[priority as keyof typeof priorityOrder] || 1;

    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      const currentTask = this.queue[i];
      if (!currentTask) {
        continue;
      }

      const existingPriority =
        priorityOrder[currentTask.priority as keyof typeof priorityOrder] || 1;

      if (taskPriority < existingPriority) {
        insertIndex = i;
        break;
      }
    }

    this.queue.splice(insertIndex, 0, task);

    if (!this.processing) {
      void this.process();
    }
  }

  dequeue(): TaskConfig | undefined {
    return this.queue.shift();
  }

  hasNext(): boolean {
    return this.queue.length > 0;
  }

  getPendingCount(): number {
    return this.queue.length;
  }

  private async process(): Promise<void> {
    this.processing = true;
    // ProcessQueue logic is handled by TaskRunner
    this.processing = false;
  }

  getQueueSnapshot(): TaskConfig[] {
    return [...this.queue];
  }

  removeTask(taskId: string): boolean {
    const index = this.queue.findIndex((task) => task.id === taskId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }
}
