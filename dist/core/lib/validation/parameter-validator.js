export class ParameterValidatorLib {
    static validateRequired(value, name) {
        if (value === undefined || value === null || value === '') {
            throw new Error(`Required parameter '${name}' is missing`);
        }
    }
    static validateRange(value, min, max, name) {
        if (typeof value !== 'number' || Number.isNaN(value)) {
            throw new Error(`Parameter '${name}' must be a number`);
        }
        if (value < min || value > max) {
            throw new Error(`Parameter '${name}' must be between ${min} and ${max}, got ${value}`);
        }
    }
    static validateEnum(value, allowedValues, name) {
        if (!allowedValues.includes(value)) {
            throw new Error(`Parameter '${name}' must be one of: ${allowedValues.join(', ')}, got '${value}'`);
        }
    }
    static validatePath(value, name, mustExist = false) {
        if (!value || typeof value !== 'string') {
            throw new Error(`Parameter '${name}' must be a valid path`);
        }
        if (mustExist) {
            const fs = require('fs');
            if (!fs.existsSync(value)) {
                throw new Error(`Path '${value}' for parameter '${name}' does not exist`);
            }
        }
    }
}
