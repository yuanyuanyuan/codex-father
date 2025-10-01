import { program } from 'commander';
import chalk from 'chalk';
import { handleMetaCommand, CommandDiscovery } from './commands/meta-commands.js';
const registeredCommands = new Map();
export class CLIParser {
    command;
    globalOptions = {
        verbose: false,
        dryRun: false,
        json: false,
        workingDirectory: process.cwd(),
        logLevel: 'info',
    };
    constructor(commandInstance) {
        this.command = commandInstance ?? program;
        this.setupGlobalOptions();
        this.setupMetaCommands();
        this.setupErrorHandling();
    }
    setupGlobalOptions() {
        this.command
            .name('codex-father')
            .description('TypeScript-based CLI tool for project management with task queues and MCP integration')
            .version('1.0.0', '-v, --version', 'Display version information')
            .helpOption('-h, --help', 'Display help information');
        this.command
            .option('--verbose', 'Enable verbose output', false)
            .option('--dry-run', 'Show what would be done without executing', false)
            .option('--json', 'Output in JSON format', false)
            .option('--config <path>', 'Specify config file path')
            .option('--cwd <path>', 'Change working directory', process.cwd())
            .option('--log-level <level>', 'Set log level (debug|info|warn|error)', this.globalOptions.logLevel);
        this.command.hook('preAction', (thisCommand) => {
            const opts = thisCommand.opts();
            this.globalOptions = {
                verbose: opts.verbose || false,
                dryRun: opts.dryRun || false,
                json: opts.json || false,
                config: opts.config,
                workingDirectory: opts.cwd || process.cwd(),
                logLevel: this.normalizeLogLevel(opts.logLevel),
            };
            if (this.globalOptions.workingDirectory !== process.cwd()) {
                try {
                    process.chdir(this.globalOptions.workingDirectory);
                }
                catch (error) {
                    this.handleError(new Error(`Failed to change directory to ${this.globalOptions.workingDirectory}: ${error}`));
                    process.exit(1);
                }
            }
        });
    }
    setupMetaCommands() {
        this.command.configureHelp({
            sortSubcommands: true,
            subcommandTerm: (cmd) => cmd.name() + ' ' + cmd.usage(),
        });
    }
    setupErrorHandling() {
        this.command.on('command:*', (operands) => {
            const unknownCommand = operands[0];
            if (this.globalOptions.json) {
                this.outputJSON({
                    success: false,
                    error: `Unknown command: ${unknownCommand}`,
                    suggestions: CommandDiscovery.getCommandSuggestions(unknownCommand),
                });
            }
            else {
                console.error(chalk.red(`❌ Unknown command: ${chalk.bold(unknownCommand)}`));
                const suggestions = CommandDiscovery.getCommandSuggestions(unknownCommand);
                if (suggestions.length > 0) {
                    console.error(chalk.yellow(`\n💡 Did you mean one of these?`));
                    suggestions.forEach((suggestion) => {
                        console.error(chalk.yellow(`   ${suggestion}`));
                    });
                }
                console.error(chalk.gray(`\nRun '${this.command.name()} --help' for available commands.`));
            }
            process.exit(1);
        });
        this.command.exitOverride((err) => {
            if (this.globalOptions.json) {
                this.outputJSON({
                    success: false,
                    error: err.message,
                    code: err.code,
                });
            }
            else {
                if (err.code === 'commander.helpDisplayed') {
                    process.exit(0);
                }
                else if (err.code === 'commander.version') {
                    process.exit(0);
                }
                else {
                    console.error(chalk.red(`❌ ${err.message}`));
                }
            }
            process.exit(err.exitCode || 1);
        });
    }
    registerCommand(name, description, handler, options) {
        const subCommand = this.command.command(name).description(description);
        if (options?.aliases) {
            options.aliases.forEach((alias) => subCommand.alias(alias));
        }
        if (options?.arguments) {
            options.arguments.forEach((arg) => {
                const argString = arg.required ? `<${arg.name}>` : `[${arg.name}]`;
                subCommand.argument(argString, arg.description);
            });
        }
        if (options?.options) {
            options.options.forEach((opt) => {
                subCommand.option(opt.flags, opt.description, opt.defaultValue);
            });
        }
        subCommand.action(async (...args) => {
            try {
                const context = this.buildCommandContext(args);
                const result = await handler(context);
                this.outputResult(result);
                if (!result.success) {
                    process.exit(1);
                }
            }
            catch (error) {
                this.handleError(error);
                process.exit(1);
            }
        });
        registeredCommands.set(name, handler);
    }
    buildCommandContext(args) {
        const command = args[args.length - 1];
        let options = {};
        if (command && typeof command.opts === 'function') {
            options = command.opts();
        }
        const commandArgs = args.slice(0, command && typeof command.opts === 'function' ? -1 : args.length);
        return {
            args: commandArgs,
            options: { ...this.globalOptions, ...options },
            workingDirectory: this.globalOptions.workingDirectory,
            configPath: this.globalOptions.config || '',
            verbose: this.globalOptions.verbose,
            dryRun: this.globalOptions.dryRun,
            json: this.globalOptions.json,
            logLevel: this.globalOptions.logLevel,
        };
    }
    outputResult(result) {
        if (this.globalOptions.json) {
            this.outputJSON(result);
        }
        else {
            this.outputHuman(result);
        }
    }
    outputJSON(data) {
        console.log(JSON.stringify(data, null, 2));
    }
    outputHuman(result) {
        if (result.message) {
            if (result.success) {
                console.log(result.message);
            }
            else {
                console.error(chalk.red(result.message));
            }
        }
        if (result.warnings && result.warnings.length > 0) {
            result.warnings.forEach((warning) => {
                console.warn(chalk.yellow(`⚠️  ${warning}`));
            });
        }
        if (result.errors && result.errors.length > 0) {
            result.errors.forEach((error) => {
                console.error(chalk.red(`❌ ${error}`));
            });
        }
        if (this.globalOptions.verbose && result.executionTime !== undefined) {
            console.log(chalk.gray(`⏱️  Execution time: ${result.executionTime}ms`));
        }
    }
    handleError(error) {
        if (this.globalOptions.json) {
            this.outputJSON({
                success: false,
                error: error.message,
                code: error.code,
                stack: this.globalOptions.verbose ? error.stack : undefined,
            });
        }
        else {
            console.error(chalk.red(`❌ Error: ${error.message}`));
            if (this.globalOptions.verbose && error.stack) {
                console.error(chalk.gray(error.stack));
            }
        }
    }
    async parse(argv) {
        try {
            const args = argv || process.argv;
            if (args.length <= 2) {
                this.command.help();
                return;
            }
            const command = args[2];
            if (!command) {
                this.command.help();
                return;
            }
            if (['--version', '-v', '--help', '-h'].includes(command)) {
                await this.command.parseAsync(args);
                return;
            }
            const context = this.buildCommandContext([]);
            const metaResult = await handleMetaCommand(command, context);
            if (metaResult) {
                this.outputResult(metaResult);
                return;
            }
            await this.command.parseAsync(args);
        }
        catch (error) {
            this.handleError(error);
            process.exit(1);
        }
    }
    getRegisteredCommands() {
        return Array.from(registeredCommands.keys());
    }
    getProgram() {
        return this.command;
    }
    normalizeLogLevel(level) {
        const allowedLevels = new Set(['debug', 'info', 'warn', 'error']);
        if (!level) {
            return 'info';
        }
        const normalized = String(level).toLowerCase();
        return (allowedLevels.has(normalized) ? normalized : 'info');
    }
}
export const parser = new CLIParser();
export function registerCommand(name, description, handler, options) {
    parser.registerCommand(name, description, handler, options);
}
export class ParameterValidator {
    static validateRequired(value, name) {
        if (value === undefined || value === null || value === '') {
            throw new Error(`Required parameter '${name}' is missing`);
        }
    }
    static validateRange(value, min, max, name) {
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
