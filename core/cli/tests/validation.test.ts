import { describe, expect, it } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';

import { ParameterValidator } from '../parser.js';

type ValidationRule =
  | { field: string; type: 'required'; message: string }
  | { field: string; type: 'range'; message: string; value: { min: number; max: number } }
  | { field: string; type: 'enum'; message: string; value: string[] }
  | { field: string; type: 'format'; message: string; value: RegExp }
  | { field: string; type: 'custom'; message: string; validator: (value: any) => boolean }
  | { field: string; type: 'path'; message: string; mustExist?: boolean };

interface ValidationOutcome {
  field: string;
  message: string;
}

function runValidation(value: any, rules: ValidationRule[]): ValidationOutcome[] {
  const errors: ValidationOutcome[] = [];

  for (const rule of rules) {
    try {
      switch (rule.type) {
        case 'required':
          ParameterValidator.validateRequired(value, rule.field);
          break;
        case 'range':
          ParameterValidator.validateRange(value, rule.value.min, rule.value.max, rule.field);
          break;
        case 'enum':
          ParameterValidator.validateEnum(value, rule.value, rule.field);
          break;
        case 'format':
          if (typeof value !== 'string' || !rule.value.test(value)) {
            throw new Error(rule.message);
          }
          break;
        case 'custom':
          if (!rule.validator(value)) {
            throw new Error(rule.message);
          }
          break;
        case 'path':
          if (rule.mustExist) {
            ParameterValidator.validatePath(value, rule.field, true);
          } else {
            ParameterValidator.validatePath(value, rule.field, false);
          }
          break;
        default:
          throw new Error(`Unknown rule type: ${(rule as any).type}`);
      }
    } catch (error) {
      errors.push({
        field: rule.field,
        message: error instanceof Error ? error.message : rule.message,
      });
    }
  }

  return errors;
}

describe('CLI Parameter Validation (T005)', () => {
  it('enforces required values', () => {
    expect(() => ParameterValidator.validateRequired('cli-task', 'task')).not.toThrow();
    expect(() => ParameterValidator.validateRequired('', 'task')).toThrowError(
      /Required parameter 'task'/
    );
  });

  it('checks numeric ranges', () => {
    expect(() => ParameterValidator.validateRange(5, 1, 10, 'priority')).not.toThrow();
    expect(() => ParameterValidator.validateRange(15, 1, 10, 'priority')).toThrowError(
      /between 1 and 10/
    );
  });

  it('restricts values to enumerations', () => {
    expect(() =>
      ParameterValidator.validateEnum('debug', ['debug', 'info'], 'logLevel')
    ).not.toThrow();
    expect(() =>
      ParameterValidator.validateEnum('trace', ['debug', 'info'], 'logLevel')
    ).toThrowError(/must be one of/);
  });

  it('verifies filesystem paths', () => {
    const packageJson = resolve(process.cwd(), 'package.json');
    expect(existsSync(packageJson)).toBe(true);

    expect(() => ParameterValidator.validatePath(packageJson, 'config', true)).not.toThrow();
    expect(() =>
      ParameterValidator.validatePath('/non/existent/path', 'config', true)
    ).toThrowError(/does not exist/);
  });

  it('runs format and custom validators through rule pipeline', () => {
    const emailRule: ValidationRule = {
      field: 'email',
      type: 'format',
      value: /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
      message: 'Invalid email address',
    };

    const customRule: ValidationRule = {
      field: 'payload',
      type: 'custom',
      validator: (value: any) => typeof value === 'object' && value !== null && 'task' in value,
      message: 'Payload must contain task field',
    };

    const requiredRule: ValidationRule = {
      field: 'email',
      type: 'required',
      message: 'Email is required',
    };

    const successErrors = runValidation('user@example.com', [requiredRule, emailRule]);
    expect(successErrors).toHaveLength(0);

    const failureErrors = runValidation('', [requiredRule, emailRule]);
    expect(failureErrors).toHaveLength(2);
    expect(failureErrors.map((error) => error.field)).toEqual(['email', 'email']);

    const customErrors = runValidation({ task: 'demo' }, [customRule]);
    expect(customErrors).toHaveLength(0);

    const customFailure = runValidation({}, [customRule]);
    expect(customFailure).toHaveLength(1);
    expect(customFailure[0]).toMatchObject({
      field: 'payload',
      message: 'Payload must contain task field',
    });
  });
});
