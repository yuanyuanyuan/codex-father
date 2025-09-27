import { TestArchitectureFramework } from './models/test-architecture.js';
import { CodeQualityStandard } from './models/code-quality.js';

export const DEFAULT_TEST_FRAMEWORK: TestArchitectureFramework = {
  id: 'default-tests',
  framework: 'vitest',
  layers: [
    { name: 'unit', directory: 'core', patterns: ['**/*.test.ts'], tools: ['vitest'], parallelExecution: true, timeout: 30000 },
  ],
  coverageRequirements: [
    { scope: 'overall', type: 'line', threshold: 80, enforcement: 'strict' },
  ],
  automationStrategy: { ciProvider: 'github-actions', triggers: ['pr'] },
  containerizedTesting: { enabled: false },
};

export const DEFAULT_CODE_QUALITY: CodeQualityStandard = {
  id: 'default-quality',
  language: 'typescript',
  linting: { tool: 'eslint', configFile: 'eslint.config.js', rules: {}, ignorePatterns: [] },
  formatting: { tool: 'prettier', configFile: '.prettierrc' },
  qualityGates: [
    { name: 'unit-coverage', metric: 'lines', threshold: 80, operator: 'gte', required: true },
  ],
  reviewChecklist: [
    { id: 'doc', text: 'Updated docs', required: true },
  ],
};

