export function isSemver(v) {
    return /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/.test(v);
}
export function detectModuleCircularDependencies(mods) {
    const graph = new Map();
    for (const m of mods) {
        graph.set(m.name, [...m.dependencies]);
    }
    const visited = new Set();
    const stack = new Set();
    const cycles = [];
    function dfs(node, path) {
        if (stack.has(node)) {
            const idx = path.indexOf(node);
            cycles.push(path.slice(idx).concat(node));
            return;
        }
        if (visited.has(node)) {
            return;
        }
        visited.add(node);
        stack.add(node);
        const next = graph.get(node) || [];
        for (const n of next) {
            dfs(n, path.concat(n));
        }
        stack.delete(node);
    }
    for (const key of graph.keys()) {
        dfs(key, [key]);
    }
    return cycles;
}
export function validateTechnicalArchitectureSpec(spec, existingIds) {
    const errors = [];
    if (!spec.id || typeof spec.id !== 'string') {
        errors.push({ field: 'id', message: 'id is required', code: 'TA_ID_REQUIRED' });
    }
    else if (existingIds && existingIds.has(spec.id)) {
        errors.push({ field: 'id', message: `id '${spec.id}' must be unique`, code: 'TA_ID_UNIQUE' });
    }
    if (!isSemver(spec.version)) {
        errors.push({
            field: 'version',
            message: `version '${spec.version}' is not semver`,
            code: 'TA_VERSION_SEMVER',
        });
    }
    const cycles = detectModuleCircularDependencies(spec.modules);
    if (cycles.length > 0) {
        errors.push({
            field: 'modules',
            message: `circular dependencies detected: ${cycles.map((c) => c.join(' -> ')).join(' | ')}`,
            code: 'TA_MODULE_CYCLE',
        });
    }
    for (const iface of spec.interfaces) {
        if (!isSemver(iface.version)) {
            errors.push({
                field: `interfaces.${iface.name}.version`,
                message: 'invalid semver',
                code: 'TA_IFACE_SEMVER',
            });
        }
    }
    return { valid: errors.length === 0, errors, warnings: [] };
}
