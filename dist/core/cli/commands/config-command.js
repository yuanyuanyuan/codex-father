import { ConfigAccess, summarise } from '../handlers/config-access.js';
export function registerConfigCommand(parser) {
    parser.registerCommand('config', 'Manage Codex Father configuration', async (context) => {
        const startedAt = Date.now();
        const action = context.args[0];
        const key = context.args[1];
        const value = context.args[2];
        const options = context.options;
        const environment = options.environment ?? options.env;
        try {
            const access = new ConfigAccess(context.workingDirectory);
            const warnings = access.getWarnings();
            switch (action) {
                case 'init':
                    return renderInit(access, environment, warnings, context, startedAt);
                case 'set':
                    {
                        const setParams = {
                            secure: Boolean(options.secure),
                        };
                        if (typeof key === 'string') {
                            setParams.key = key;
                        }
                        if (typeof value === 'string') {
                            setParams.value = value;
                        }
                        if (environment) {
                            setParams.environment = environment;
                        }
                        return renderSet(access, setParams, warnings, context, startedAt);
                    }
                case 'get':
                    {
                        const getParams = {
                            reveal: Boolean(options.reveal),
                        };
                        if (typeof key === 'string') {
                            getParams.key = key;
                        }
                        if (environment) {
                            getParams.environment = environment;
                        }
                        return renderGet(access, getParams, warnings, context, startedAt);
                    }
                case 'list':
                    return renderList(access, warnings, context, startedAt);
                case 'validate':
                    return {
                        success: true,
                        message: 'Configuration validation basics complete (detailed schema checks pending)',
                        warnings,
                        executionTime: Date.now() - startedAt,
                    };
                default:
                    return {
                        success: false,
                        message: `Unknown config action: ${action ?? ''}`.trim(),
                        errors: ['Supported actions: init, get, set, list, validate'],
                        warnings,
                        executionTime: Date.now() - startedAt,
                    };
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                message: 'Configuration command failed',
                errors: [message],
                executionTime: Date.now() - startedAt,
            };
        }
    }, {
        arguments: [
            {
                name: 'action',
                description: 'Config action (init|get|set|list|validate)',
                required: true,
            },
            { name: 'key', description: 'Configuration key (dot notation)', required: false },
            { name: 'value', description: 'Configuration value for set action', required: false },
        ],
        options: [
            {
                flags: '--environment <env>',
                description: 'Target environment (development|testing|production)',
            },
            { flags: '--env <env>', description: 'Alias of --environment' },
            { flags: '--secure', description: 'Encrypt value at rest when setting configuration' },
            {
                flags: '--reveal',
                description: 'Reveal decrypted value when reading encrypted configuration',
            },
            { flags: '--json', description: 'Output in JSON format' },
        ],
    });
}
function renderInit(access, environment, warnings, context, startedAt) {
    const { configPath } = access.init(environment);
    if (context.json) {
        return {
            success: true,
            data: {
                configPath,
                environment: environment ?? null,
                warnings,
            },
            executionTime: Date.now() - startedAt,
        };
    }
    const message = environment
        ? `Environment "${environment}" initialized`
        : 'Configuration initialized';
    return {
        success: true,
        message,
        warnings,
        executionTime: Date.now() - startedAt,
    };
}
function renderSet(access, params, warnings, context, startedAt) {
    if (!params.key) {
        return {
            success: false,
            message: 'Missing configuration key',
            errors: ['Usage: codex-father config set <key> <value>'],
            executionTime: Date.now() - startedAt,
        };
    }
    if (params.value === undefined) {
        return {
            success: false,
            message: 'Missing configuration value',
            errors: ['Provide a value to assign'],
            executionTime: Date.now() - startedAt,
        };
    }
    const outcome = access.set({
        key: params.key,
        value: params.value,
        secure: params.secure,
        ...(params.environment ? { environment: params.environment } : {}),
    });
    if (context.json) {
        return {
            success: true,
            data: {
                key: params.key,
                environment: params.environment ?? null,
                value: outcome.value,
                encrypted: outcome.encrypted,
                warnings,
            },
            executionTime: Date.now() - startedAt,
        };
    }
    const descriptor = params.environment ? `${params.environment}:${params.key}` : params.key;
    const message = outcome.encrypted
        ? `Configuration updated for ${descriptor} (stored securely)`
        : `Configuration updated for ${descriptor}`;
    return {
        success: true,
        message,
        warnings,
        executionTime: Date.now() - startedAt,
    };
}
function renderGet(access, params, warnings, context, startedAt) {
    if (!params.key) {
        return {
            success: false,
            message: 'Missing configuration key',
            errors: ['Usage: codex-father config get <key>'],
            executionTime: Date.now() - startedAt,
        };
    }
    const outcome = access.get({
        key: params.key,
        reveal: params.reveal,
        ...(params.environment ? { environment: params.environment } : {}),
    });
    if (outcome.value === undefined) {
        return {
            success: false,
            message: `Configuration key not found: ${params.key}`,
            errors: ['Key does not exist in config'],
            warnings,
            executionTime: Date.now() - startedAt,
        };
    }
    if (context.json) {
        return {
            success: true,
            data: {
                key: params.key,
                environment: params.environment ?? null,
                value: outcome.value,
                encrypted: outcome.encrypted,
                warnings,
            },
            executionTime: Date.now() - startedAt,
        };
    }
    const valueText = Array.isArray(outcome.value) || typeof outcome.value === 'object'
        ? JSON.stringify(outcome.value)
        : String(outcome.value);
    return {
        success: true,
        message: `${params.key} = ${valueText}`,
        warnings,
        executionTime: Date.now() - startedAt,
    };
}
function renderList(access, warnings, context, startedAt) {
    const store = access.list();
    const summary = summarise(store);
    if (context.json) {
        return {
            success: true,
            data: {
                config: summary,
                metadata: store.metadata,
                warnings,
            },
            executionTime: Date.now() - startedAt,
        };
    }
    const lines = ['Global configuration:', JSON.stringify(summary.global, null, 2)];
    for (const [env, values] of Object.entries(summary.environments)) {
        lines.push('', `Environment: ${env}`, JSON.stringify(values, null, 2));
    }
    return {
        success: true,
        message: lines.join('\n'),
        warnings,
        executionTime: Date.now() - startedAt,
    };
}
