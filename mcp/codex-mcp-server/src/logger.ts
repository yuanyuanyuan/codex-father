export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

export function isValidLogLevel(value: string): value is LogLevel {
  return value in LOG_LEVEL_PRIORITY;
}

export class CliLogger {
  private level: LogLevel;

  constructor(level: LogLevel) {
    this.level = level;
  }

  setLevel(level: LogLevel) {
    this.level = level;
  }

  debug(message: string) {
    this.log('debug', message);
  }

  info(message: string) {
    this.log('info', message);
  }

  warn(message: string) {
    this.log('warn', message);
  }

  error(message: string) {
    this.log('error', message);
  }

  banner(lines: string[]) {
    for (const line of lines) {
      this.info(line);
    }
  }

  private log(level: LogLevel, message: string) {
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.level]) {
      return;
    }
    const ts = new Date().toISOString();
    const formatted = `[${ts}] [${level.toUpperCase()}] ${message}`;
    process.stderr.write(`${formatted}\n`);
  }
}
