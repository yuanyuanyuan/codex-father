import { type ScriptResult } from './scripts.js';
import type { CommandContext, CommandResult } from '../lib/types.js';
export declare function adaptScriptResult(scriptResult: ScriptResult): CommandResult;
export declare class LegacyCommandHandler {
    static handleStart(context: CommandContext): Promise<CommandResult>;
    static handleJob(context: CommandContext): Promise<CommandResult>;
    static handleTest(context: CommandContext): Promise<CommandResult>;
}
export declare function shouldUseLegacyHandler(command: string): boolean;
export declare function routeLegacyCommand(command: string, context: CommandContext): Promise<CommandResult | null>;
export declare function createLegacyLinks(): Promise<void>;
export declare function validateLegacyScripts(): Promise<{
    valid: boolean;
    missing: string[];
    issues: string[];
}>;
