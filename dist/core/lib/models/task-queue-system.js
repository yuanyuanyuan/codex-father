export function canTransitionStatus(from, to) {
    const allowed = {
        pending: ['processing', 'cancelled'],
        processing: ['completed', 'failed', 'retrying', 'cancelled'],
        completed: [],
        failed: ['retrying'],
        retrying: ['processing', 'failed'],
        cancelled: [],
    };
    return allowed[from]?.includes(to) ?? false;
}
export function nextRetryDelay(policy, attempt) {
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
