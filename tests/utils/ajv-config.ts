/**
 * Shared AJV configuration for all tests
 * Ensures consistent schema validation across the codebase
 */

import Ajv from 'ajv';

/**
 * Create a properly configured AJV instance for schema validation
 * 
 * Configuration:
 * - strict: false - Allows some JSON Schema features not in strict mode
 * - allErrors: true - Collects all validation errors instead of stopping at first
 * - removeAdditional: false - Don't modify the validated object
 * - useDefaults: false - Don't apply default values from schema
 * 
 * Note: additionalProperties in schemas will be properly enforced by default
 */
export function createAjvValidator(): Ajv {
  return new Ajv({
    strict: false,
    allErrors: true,
    removeAdditional: false,
    useDefaults: false,
  });
}

// Export a singleton instance for convenience
export const ajv = createAjvValidator();
