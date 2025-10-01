export function validateCodeQualityStandard(std) {
    const errors = [];
    if (!std.id) {
        errors.push({ field: 'id', message: 'id required', code: 'CQ_ID_REQUIRED' });
    }
    if (!std.linting?.configFile) {
        errors.push({
            field: 'linting.configFile',
            message: 'config file required',
            code: 'CQ_LINT_CFG',
        });
    }
    if (!Array.isArray(std.qualityGates)) {
        errors.push({
            field: 'qualityGates',
            message: 'qualityGates required',
            code: 'CQ_QG_REQUIRED',
        });
    }
    return { valid: errors.length === 0, errors, warnings: [] };
}
export function evaluateQualityGates(metrics, gates) {
    const failed = [];
    for (const gate of gates) {
        const value = metrics[gate.metric];
        let ok = false;
        if (typeof value !== 'number') {
            if (gate.required) {
                failed.push(gate);
            }
            continue;
        }
        switch (gate.operator) {
            case 'gt':
                ok = value > gate.threshold;
                break;
            case 'gte':
                ok = value >= gate.threshold;
                break;
            case 'lt':
                ok = value < gate.threshold;
                break;
            case 'lte':
                ok = value <= gate.threshold;
                break;
            case 'eq':
                ok = value === gate.threshold;
                break;
        }
        if (!ok && gate.required) {
            failed.push(gate);
        }
    }
    return { pass: failed.length === 0, failed };
}
