export declare class ParameterValidatorLib {
    static validateRequired(value: any, name: string): void;
    static validateRange(value: number, min: number, max: number, name: string): void;
    static validateEnum(value: string, allowedValues: string[], name: string): void;
    static validatePath(value: string, name: string, mustExist?: boolean): void;
}
