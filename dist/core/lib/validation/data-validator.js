export class DataValidator {
    static semverRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/;
    static validateSemver(value, field = 'version') {
        const valid = DataValidator.semverRegex.test(value);
        const errors = valid
            ? []
            : [{ field, message: 'invalid semver', code: 'VAL_SEMVER' }];
        return { valid, errors, warnings: [] };
    }
    static validateUniqueId(id, existing, field = 'id') {
        const valid = id !== '' && !existing.has(id);
        const errors = valid
            ? []
            : [{ field, message: 'id must be unique', code: 'VAL_UNIQUE' }];
        return { valid, errors, warnings: [] };
    }
    static detectCycles(nodes, edges) {
        const graph = new Map();
        nodes.forEach((n) => graph.set(n, []));
        edges.forEach(([a, b]) => graph.get(a)?.push(b));
        const visited = new Set();
        const stack = new Set();
        const cycles = [];
        function dfs(n, path) {
            if (stack.has(n)) {
                const idx = path.indexOf(n);
                cycles.push(path.slice(idx).concat(n));
                return;
            }
            if (visited.has(n)) {
                return;
            }
            visited.add(n);
            stack.add(n);
            for (const m of graph.get(n) || []) {
                dfs(m, path.concat(m));
            }
            stack.delete(n);
        }
        for (const n of graph.keys()) {
            dfs(n, [n]);
        }
        return cycles;
    }
    static validateAgainstSchema(obj, schema) {
        const errors = [];
        for (const [k, s] of Object.entries(schema)) {
            const v = obj[k];
            if (s.required && (v === undefined || v === null)) {
                errors.push({ field: k, message: 'is required', code: 'VAL_REQ' });
                continue;
            }
            if (v !== undefined && v !== null) {
                const t = Array.isArray(v) ? 'array' : typeof v;
                if (t !== s.type) {
                    errors.push({ field: k, message: `expected ${s.type}`, code: 'VAL_TYPE' });
                }
            }
        }
        return { valid: errors.length === 0, errors, warnings: [] };
    }
}
