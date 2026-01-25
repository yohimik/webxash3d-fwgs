import pino from "pino";

// ============================================
// Log Levels
// ============================================

export type LogLevelString = "debug" | "info" | "warn" | "error" | "silent";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

// Map string levels to enum
const levelStringToEnum: Record<LogLevelString, LogLevel> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
  silent: LogLevel.NONE,
};

// ============================================
// Cached Log Entry
// ============================================

interface CachedLog {
  level: LogLevelString;
  args: unknown[];
  timestamp: number;
}

// ============================================
// Logger Wrapper Class
// ============================================

class LoggerWrapper {
  private cachedLogs: CachedLog[] = [];
  private pinoInstance: pino.Logger | null = null;
  private isInitialized = false;
  private currentLevel: LogLevel = LogLevel.INFO;
  private prefix = "[Admin]";

  /**
   * Initializes the logger with a specific level
   */
  initialize(level: LogLevelString = "info"): void {
    this.pinoInstance = pino({
      level,
      browser: {
        asObject: false,
        serialize: false,
        transmit: undefined,
      },
    });
    this.currentLevel = levelStringToEnum[level];
    this.isInitialized = true;
    this.flushCachedLogs();
  }

  /**
   * Sets the log level
   */
  setLevel(level: LogLevelString): void {
    this.currentLevel = levelStringToEnum[level];
    if (this.pinoInstance) {
      this.pinoInstance.level = level;
    }
  }

  /**
   * Gets the current log level
   */
  getLevel(): LogLevel {
    return this.currentLevel;
  }

  /**
   * Checks if the logger is initialized
   */
  get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Flushes cached logs to the pino instance
   */
  private flushCachedLogs(): void {
    if (!this.pinoInstance) return;

    for (const log of this.cachedLogs) {
      this.logToPino(log.level, ...log.args);
    }
    this.cachedLogs = [];
  }

  /**
   * Formats arguments with prefix and timestamp
   */
  private formatArgs(...args: unknown[]): string {
    const now = new Date();
    const time = now.toTimeString().slice(0, 8);
    return `[${time}] ${this.prefix} ${args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")}`;
  }

  /**
   * Logs to pino instance
   */
  private logToPino(level: LogLevelString, ...args: unknown[]): void {
    if (!this.pinoInstance) return;

    const message = this.formatArgs(...args);

    switch (level) {
      case "debug":
        this.pinoInstance.debug(message);
        break;
      case "info":
        this.pinoInstance.info(message);
        break;
      case "warn":
        this.pinoInstance.warn(message);
        break;
      case "error":
        this.pinoInstance.error(message);
        break;
    }
  }

  /**
   * Caches a log entry
   */
  private cacheLog(level: LogLevelString, ...args: unknown[]): void {
    this.cachedLogs.push({
      level,
      args,
      timestamp: Date.now(),
    });
  }

  /**
   * Logs debug messages
   */
  debug(...args: unknown[]): void {
    if (this.isInitialized) {
      this.logToPino("debug", ...args);
    } else {
      this.cacheLog("debug", ...args);
    }
  }

  /**
   * Logs info messages
   */
  info(...args: unknown[]): void {
    if (this.isInitialized) {
      this.logToPino("info", ...args);
    } else {
      this.cacheLog("info", ...args);
    }
  }

  /**
   * Logs warning messages
   */
  warn(...args: unknown[]): void {
    if (this.isInitialized) {
      this.logToPino("warn", ...args);
    } else {
      this.cacheLog("warn", ...args);
    }
  }

  /**
   * Logs error messages
   */
  error(...args: unknown[]): void {
    if (this.isInitialized) {
      this.logToPino("error", ...args);
    } else {
      this.cacheLog("error", ...args);
    }
  }

  /**
   * Logs messages (alias for info)
   */
  log(...args: unknown[]): void {
    this.info(...args);
  }
}

// Export singleton instance
export const logger = new LoggerWrapper();

// Export class for type usage
export { LoggerWrapper };
