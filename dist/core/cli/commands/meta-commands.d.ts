import type { CommandContext, CommandResult } from '../../lib/types.js';
interface CommandInfo {
    name: string;
    description: string;
    aliases?: string[];
    status: 'available' | 'planned' | 'deprecated';
}
export declare class VersionCommand {
    static handle(context: CommandContext): Promise<CommandResult>;
}
export declare class HelpCommand {
    static handle(context: CommandContext): Promise<CommandResult>;
    private static generateHelpText;
    private static getUsageExamples;
}
export declare class CommandDiscovery {
    static getAvailableCommands(): CommandInfo[];
    static getPlannedCommands(): CommandInfo[];
    static findCommand(name: string): CommandInfo | null;
    static isCommandAvailable(name: string): boolean;
    static getCommandSuggestions(input: string): string[];
    private static levenshteinDistance;
}
export declare function handleMetaCommand(command: string, context: CommandContext): Promise<CommandResult | null>;
export {};
