export function canTransitionDirectoryStatus(current, next) {
    const order = ['draft', 'review', 'approved', 'implemented'];
    return order.indexOf(next) - order.indexOf(current) === 1;
}
export function validateDirectoryArchitecture(standard) {
    const errors = [];
    if (!standard.id) {
        errors.push({ field: 'id', message: 'id is required', code: 'DA_ID_REQUIRED' });
    }
    if (!standard.structure) {
        errors.push({
            field: 'structure',
            message: 'structure required',
            code: 'DA_STRUCTURE_REQUIRED',
        });
    }
    for (const conv of standard.namingConventions) {
        try {
            new RegExp(conv.pattern);
        }
        catch {
            errors.push({
                field: `namingConventions.${conv.scope}`,
                message: 'invalid regex pattern',
                code: 'DA_REGEX_INVALID',
            });
        }
    }
    const layerIndex = new Map();
    standard.layeringStrategy.forEach((l, i) => layerIndex.set(l.layer, i));
    for (const l of standard.layeringStrategy) {
        for (const dep of l.canDependOn) {
            if ((layerIndex.get(dep) ?? Infinity) > (layerIndex.get(l.layer) ?? -Infinity)) {
                errors.push({
                    field: 'layeringStrategy',
                    message: `layer '${l.layer}' cannot depend upward on '${dep}'`,
                    code: 'DA_LAYER_ORDER',
                });
            }
        }
    }
    return { valid: errors.length === 0, errors, warnings: [] };
}
