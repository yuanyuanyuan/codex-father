import { Command } from 'commander';
import type { CommandContext, CommandResult } from '../lib/types.js';
export interface CommandHandler {
    (context: CommandContext): Promise<CommandResult>;
}
export declare class CLIParser {
    private command;
    private globalOptions;
    constructor(commandInstance?: Command);
    private setupGlobalOptions;
    private setupMetaCommands;
    private setupErrorHandling;
    registerCommand(name: string, description: string, handler: CommandHandler, options?: {
        aliases?: string[];
        arguments?: Array<{
            name: string;
            description: string;
            required?: boolean;
        }>;
        options?: Array<{
            flags: string;
            description: string;
            defaultValue?: any;
        }>;
    }): void;
    private buildCommandContext;
    private outputResult;
    private outputJSON;
    private outputHuman;
    private handleError;
    parse(argv?: string[]): Promise<void>;
    getRegisteredCommands(): string[];
    getProgram(): Command;
    private normalizeLogLevel;
}
export declare const parser: CLIParser;
export declare function registerCommand(name: string, description: string, handler: CommandHandler, options?: Parameters<CLIParser['registerCommand']>[3]): void;
export declare class ParameterValidator {
    static validateRequired(value: any, name: string): void;
    static validateRange(value: number, min: number, max: number, name: string): void;
    static validateEnum(value: string, allowedValues: string[], name: string): void;
    static validatePath(value: string, name: string, mustExist?: boolean): void;
}
