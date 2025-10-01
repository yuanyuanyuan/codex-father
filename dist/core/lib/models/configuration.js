export function validateConfiguration(config, obj) {
    const errors = [];
    for (const [key, field] of Object.entries(config.schema.fields)) {
        const val = obj[key];
        if (field.required && (val === undefined || val === null)) {
            errors.push({ field: key, message: 'is required', code: 'CFG_REQUIRED' });
            continue;
        }
        if (val !== undefined && val !== null) {
            const ok = (field.type === 'string' && typeof val === 'string') ||
                (field.type === 'number' && typeof val === 'number') ||
                (field.type === 'boolean' && typeof val === 'boolean') ||
                (field.type === 'object' && typeof val === 'object' && !Array.isArray(val)) ||
                (field.type === 'array' && Array.isArray(val));
            if (!ok) {
                errors.push({ field: key, message: `expected ${field.type}`, code: 'CFG_TYPE' });
            }
        }
    }
    for (const rule of config.validation) {
        const v = obj[rule.field];
        if (!rule.validator(v)) {
            errors.push({ field: rule.field, message: rule.message, code: 'CFG_RULE' });
        }
    }
    return { valid: errors.length === 0, errors, warnings: [] };
}
