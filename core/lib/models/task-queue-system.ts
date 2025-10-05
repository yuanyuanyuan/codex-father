// Distinct model types to avoid clashing with existing queue types
export type DMTaskStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'retrying'
  | 'cancelled';

export interface RetryPolicy {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
  maxDelay: number;
}

export interface PriorityLevel {
  name: string;
  value: number; // higher means higher priority
}

export interface MonitoringConfig {
  enabled: boolean;
  sampleRate?: number; // 0-1
}

export interface DMTask {
  id: string;
  type: string;
  priority: number;
  payload: Record<string, unknown>;
  status: DMTaskStatus;
  createdAt: Date;
  updatedAt: Date;
  attempts: number;
  lastError?: string;
  scheduledAt?: Date;
}

export interface TaskQueueSystem {
  id: string;
  queueDirectory: string;
  maxConcurrency: number;
  retryPolicy: RetryPolicy;
  priorityLevels: PriorityLevel[];
  monitoring: MonitoringConfig;
}

export function canTransitionStatus(from: DMTaskStatus, to: DMTaskStatus): boolean {
  const allowed: Record<DMTaskStatus, DMTaskStatus[]> = {
    pending: ['processing', 'cancelled'],
    processing: ['completed', 'failed', 'retrying', 'cancelled'],
    completed: [],
    failed: ['retrying'],
    retrying: ['processing', 'failed'],
    cancelled: [],
  };
  return allowed[from]?.includes(to) ?? false;
}

export function nextRetryDelay(policy: RetryPolicy, attempt: number): number {
  const a = Math.max(1, attempt);
  let delay = policy.baseDelay;
  switch (policy.backoffStrategy) {
    case 'fixed':
      delay = policy.baseDelay;
      break;
    case 'linear':
      delay = policy.baseDelay * a;
      break;
    case 'exponential':
      delay = policy.baseDelay * Math.pow(2, a - 1);
      break;
  }
  return Math.min(delay, policy.maxDelay);
}
