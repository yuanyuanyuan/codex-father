import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  isSemver as isSemverTA,
  validateTechnicalArchitectureSpec,
  detectModuleCircularDependencies,
} from '../models/technical-architecture.js';
import {
  canTransitionDirectoryStatus,
  validateDirectoryArchitecture,
  type DirectoryArchitectureStandard,
} from '../models/directory-architecture.js';
import {
  evaluateQualityGates,
  validateCodeQualityStandard,
  type CodeQualityStandard,
} from '../models/code-quality.js';
import {
  validateTestFramework,
  type TestArchitectureFramework,
} from '../models/test-architecture.js';
import {
  canTransitionStatus as canTransitionTask,
  nextRetryDelay,
  type TaskQueueSystem,
} from '../models/task-queue-system.js';
import { validateConfiguration, type ConfigurationManagement } from '../models/configuration.js';
import {
  validateSecurityCompliance,
  type SecurityComplianceFramework,
} from '../models/security-compliance.js';
import { DataValidator } from '../validation/data-validator.js';
import { ParameterValidatorLib } from '../validation/parameter-validator.js';
import { LogStorage } from '../storage/log-storage.js';
import { FileStorage } from '../storage/file-storage.js';
import { ConfigStorage } from '../storage/config-storage.js';
import { isSemver, deepClone, clamp, joinPath } from '../utils/common.js';
import { ErrorManager } from '../errors/error-manager.js';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('Data Models and Validation (T031-T045)', () => {
  it('technical-architecture: semver check and cycle detection', () => {
    expect(isSemverTA('1.2.3')).toBe(true);
    expect(isSemverTA('1.2')).toBe(false);

    const cycles = detectModuleCircularDependencies([
      { name: 'a', path: 'a', responsibilities: [], dependencies: ['b'], exports: [] },
      { name: 'b', path: 'b', responsibilities: [], dependencies: ['c'], exports: [] },
      { name: 'c', path: 'c', responsibilities: [], dependencies: ['a'], exports: [] },
    ]);
    expect(cycles.length).toBe(1);

    const spec = {
      id: 'arch-1',
      name: 'Arch',
      version: '1.0.0',
      principles: [],
      modules: [
        { name: 'core', path: 'core', responsibilities: [], dependencies: [], exports: [] },
      ],
      interfaces: [{ name: 'IFace', version: '1.0.0', methods: [] }],
      integrationRules: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(validateTechnicalArchitectureSpec(spec).valid).toBe(true);
    const bad = {
      ...spec,
      version: 'not-a-semver',
      interfaces: [{ name: 'I', version: 'x', methods: [] }],
    };
    const result = validateTechnicalArchitectureSpec(bad, new Set(['arch-1']));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'TA_ID_UNIQUE')).toBe(true);
    expect(result.errors.some((e) => e.code === 'TA_VERSION_SEMVER')).toBe(true);
    expect(result.errors.some((e) => e.code === 'TA_IFACE_SEMVER')).toBe(true);
  });

  it('directory-architecture: status transition and validation', () => {
    expect(canTransitionDirectoryStatus('draft', 'review')).toBe(true);
    expect(canTransitionDirectoryStatus('draft', 'approved')).toBe(false);

    const standard: DirectoryArchitectureStandard = {
      id: 'dir-1',
      name: 'Dirs',
      structure: {
        name: 'root',
        type: 'directory',
        description: '',
        purpose: 'root',
        owner: 'team',
      },
      namingConventions: [
        { scope: 'file', pattern: '^[a-z]+\\.ts$', examples: ['a.ts'], exceptions: [] },
      ],
      layeringStrategy: [
        { layer: 'core', canDependOn: [] },
        { layer: 'app', canDependOn: ['infra'] }, // invalid upward
        { layer: 'infra', canDependOn: ['core'] },
      ],
      migrationPlan: [],
      status: 'draft',
    };
    const res = validateDirectoryArchitecture(standard);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.code === 'DA_LAYER_ORDER')).toBe(true);

    // invalid regex
    const res2 = validateDirectoryArchitecture({
      ...standard,
      layeringStrategy: [{ layer: 'core', canDependOn: [] }],
      namingConventions: [{ scope: 'file', pattern: '[', examples: [], exceptions: [] }],
    });
    expect(res2.valid).toBe(false);
    expect(res2.errors.some((e) => e.code === 'DA_REGEX_INVALID')).toBe(true);
  });

  it('code-quality: gates evaluation and validation', () => {
    const std: CodeQualityStandard = {
      id: 'q',
      language: 'typescript',
      linting: { tool: 'eslint', configFile: 'eslint.config.js', rules: {}, ignorePatterns: [] },
      formatting: { tool: 'prettier', configFile: '.prettierrc' },
      qualityGates: [
        { name: 'gt', metric: 'm', threshold: 1, operator: 'gt', required: true },
        { name: 'gte', metric: 'm', threshold: 2, operator: 'gte', required: true },
        { name: 'lt', metric: 'm', threshold: 5, operator: 'lt', required: true },
        { name: 'lte', metric: 'm', threshold: 4, operator: 'lte', required: true },
        { name: 'eq', metric: 'm', threshold: 3, operator: 'eq', required: true },
      ],
      reviewChecklist: [],
    };
    const metrics = { m: 3 };
    const { pass, failed } = evaluateQualityGates(metrics, std.qualityGates);
    expect(pass).toBe(true);
    expect(failed).toHaveLength(0);

    const invalid = validateCodeQualityStandard({
      ...std,
      linting: { ...std.linting, configFile: '' },
    });
    expect(invalid.valid).toBe(false);
  });

  it('test-architecture: validation of layers and coverage', () => {
    const good: TestArchitectureFramework = {
      id: 't',
      framework: 'vitest',
      layers: [
        {
          name: 'unit',
          directory: 'core',
          patterns: ['**/*.test.ts'],
          tools: ['vitest'],
          parallelExecution: true,
          timeout: 10,
        },
      ],
      coverageRequirements: [
        { scope: 'overall', type: 'line', threshold: 80, enforcement: 'strict' },
      ],
      automationStrategy: { ciProvider: 'github-actions', triggers: ['pr'] },
      containerizedTesting: { enabled: false },
    };
    expect(validateTestFramework(good).valid).toBe(true);
    const bad = {
      ...good,
      id: '',
      coverageRequirements: [
        { scope: 'core', type: 'branch', threshold: 120, enforcement: 'warning' },
      ],
    };
    const res = validateTestFramework(bad);
    expect(res.valid).toBe(false);
  });

  it('task-queue-system: transitions and backoff', () => {
    expect(canTransitionTask('pending', 'processing')).toBe(true);
    expect(canTransitionTask('completed', 'pending')).toBe(false);
    expect(
      nextRetryDelay(
        { baseDelay: 100, maxDelay: 5000, backoffStrategy: 'fixed', maxAttempts: 3 },
        2
      )
    ).toBe(100);
    expect(
      nextRetryDelay(
        { baseDelay: 100, maxDelay: 5000, backoffStrategy: 'linear', maxAttempts: 3 },
        3
      )
    ).toBe(300);
    expect(
      nextRetryDelay(
        { baseDelay: 100, maxDelay: 5000, backoffStrategy: 'exponential', maxAttempts: 3 },
        3
      )
    ).toBe(400);
    expect(
      nextRetryDelay(
        { baseDelay: 10_000, maxDelay: 1000, backoffStrategy: 'exponential', maxAttempts: 3 },
        5
      )
    ).toBe(1000);
  });

  it('configuration: schema + custom rules', () => {
    const cfg: ConfigurationManagement = {
      id: 'cfg',
      configFiles: [],
      environments: [],
      schema: { fields: { name: { type: 'string', required: true }, count: { type: 'number' } } },
      validation: [
        {
          field: 'name',
          validator: (v) => typeof v === 'string' && v.length > 1,
          message: 'name too short',
        },
      ],
    };
    const ok = validateConfiguration(cfg, { name: 'ok', count: 1 });
    expect(ok.valid).toBe(true);
    const bad = validateConfiguration(cfg, { name: '' });
    expect(bad.valid).toBe(false);
  });

  it('security-compliance: audit outputs required when enabled', () => {
    const s: SecurityComplianceFramework = {
      id: 'sec',
      sandboxStrategies: [],
      dataProtection: [],
      complianceChecks: [],
      auditLogging: {
        enabled: true,
        logLevel: 'info',
        retention: 7,
        sensitiveDataHandling: 'redact',
        outputs: [{ type: 'console' }],
      },
    };
    expect(validateSecurityCompliance(s).valid).toBe(true);
    const s2 = { ...s, auditLogging: { ...s.auditLogging, outputs: [] } };
    expect(validateSecurityCompliance(s2).valid).toBe(false);
  });

  it('data-validator: semver, unique id, schema, cycles', () => {
    expect(DataValidator.validateSemver('1.0.0').valid).toBe(true);
    expect(DataValidator.validateSemver('1').valid).toBe(false);
    expect(DataValidator.validateUniqueId('a', new Set(['b'])).valid).toBe(true);
    expect(DataValidator.validateUniqueId('a', new Set(['a'])).valid).toBe(false);
    const cyc = DataValidator.detectCycles(
      ['a', 'b', 'c'],
      [
        ['a', 'b'],
        ['b', 'c'],
        ['c', 'a'],
      ]
    );
    expect(cyc.length).toBe(1);
    const schemaRes = DataValidator.validateAgainstSchema(
      { s: 'x', n: 1, b: true, a: [] },
      {
        s: { type: 'string', required: true },
        n: { type: 'number' },
        b: { type: 'boolean' },
        a: { type: 'array' },
      }
    );
    expect(schemaRes.valid).toBe(true);
  });

  it('parameter-validator: basic checks', () => {
    expect(() => ParameterValidatorLib.validateRequired('x', 'f')).not.toThrow();
    expect(() => ParameterValidatorLib.validateRange(2, 1, 3, 'n')).not.toThrow();
    expect(() => ParameterValidatorLib.validateEnum('a', ['a', 'b'], 'e')).not.toThrow();
  });

  describe('storage + utils', () => {
    let tmp: string;
    beforeAll(() => {
      tmp = mkdtempSync(join(tmpdir(), 'model-tests-'));
    });
    afterAll(() => {
      rmSync(tmp, { recursive: true, force: true });
    });

    it('file-storage: atomic write, lock, backup, size', () => {
      const fs = new FileStorage(tmp);
      fs.writeJSON('a/b.json', { ok: true });
      expect(JSON.parse(readFileSync(join(tmp, 'a/b.json'), 'utf8')).ok).toBe(true);
      const lock = fs.acquireLock('locks/test');
      lock.release();
      const b = fs.backup('a/b.json');
      expect(existsSync(b)).toBe(true);
      expect(fs.size('a/b.json')).toBeGreaterThan(0);
    });

    it('config-storage: path mapping read/write/backup', () => {
      const cs = new ConfigStorage(tmp);
      cs.write('architecture/technical-spec', { id: 1 });
      expect(cs.read<any>('architecture/technical-spec').id).toBe(1);
      const b = cs.backup('architecture/technical-spec');
      expect(existsSync(b)).toBe(true);
    });

    it('log-storage: append and rotate', () => {
      const ls = new LogStorage(tmp);
      ls.append('system', 'hello');
      // small threshold forces rotation
      ls.rotate('system', { maxSizeBytes: 1, keep: 2 });
      const latest1 = join(tmp, 'system/latest.1.log');
      expect(existsSync(latest1)).toBe(true);
    });

    it('utils: semver, deepClone, clamp, joinPath', () => {
      expect(isSemver('1.2.3')).toBe(true);
      expect(isSemver('1.2')).toBe(false);
      const obj = { a: 1, b: { c: 2 } };
      const clone = deepClone(obj);
      expect(clone).not.toBe(obj);
      expect(clone.b).not.toBe(obj.b);
      expect(clamp(5, 0, 3)).toBe(3);
      expect(joinPath('a/', '/b', 'c')).toContain('a/');
    });

    it('error-manager: register and create', () => {
      ErrorManager.register({ code: 'E_TEST', message: 'x', category: 'unknown' });
      const err = ErrorManager.create('E_TEST');
      // @ts-expect-error extra field
      expect((err as any).code).toBe('E_TEST');
      const u = ErrorManager.create('NOPE');
      // @ts-expect-error extra field
      expect((u as any).code).toBe('NOPE');
    });
  });
});
