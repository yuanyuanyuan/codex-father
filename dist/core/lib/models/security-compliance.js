export function validateSecurityCompliance(fr) {
    const errors = [];
    if (!fr.id) {
        errors.push({ field: 'id', message: 'id required', code: 'SC_ID_REQUIRED' });
    }
    if (!fr.auditLogging) {
        errors.push({
            field: 'auditLogging',
            message: 'audit config required',
            code: 'SC_AUDIT_REQUIRED',
        });
    }
    if (fr.auditLogging && fr.auditLogging.enabled) {
        const hasOutput = Array.isArray(fr.auditLogging.outputs) && fr.auditLogging.outputs.length > 0;
        if (!hasOutput) {
            errors.push({
                field: 'auditLogging.outputs',
                message: 'at least one output',
                code: 'SC_AUDIT_OUTPUT',
            });
        }
    }
    return { valid: errors.length === 0, errors, warnings: [] };
}
