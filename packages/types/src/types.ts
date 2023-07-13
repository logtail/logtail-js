/**
 * Logtail library options
 */

export interface ILogtailOptions {
  /**
   * Endpoint URL for syncing logs with Logtail.com
   */
  endpoint: string;

  /**
   * Maximum number of logs to sync in a single request to Logtail.com
   */
  batchSize: number;

  /**
   * Max interval (in milliseconds) before a batch of logs proceeds to syncing
   */
  batchInterval: number;

  /**
   * Maximum number of times to retry a failed sync request
   */
  retryCount: number;

  /**
   * Minimum number of milliseconds to wait before retrying a failed sync request
   */
  retryBackoff: number;

  /**
   * Maximum number of sync requests to make concurrently (useful to limit
   * network I/O)
   */
  syncMax: number;

  /**
   * Errors when sending logs will be silently ignored
   * Has precedence over throwExceptions
   */
  ignoreExceptions: boolean;

  /**
   * Errors when sending logs will result in thrown exceptions
   */
  throwExceptions: boolean;

  /**
   * Maximum depth (number of attribute levels) of a context object
   **/
  contextObjectMaxDepth: number;

  /**
   * Boolean to produce a warning when context object max depth is reached
   **/
  contextObjectMaxDepthWarn: boolean;

  /**
   * Boolean to produce a warning when circular reference is found in context
   **/
  contextObjectCircularRefWarn: boolean;

  /**
   * If true, all logs will be sent to standard console functions (console.info, console.warn, ...)
   **/
  sendLogsToConsoleOutput: boolean;

  /**
   * If true, all logs will be sent to Better Stack
   **/
  sendLogsToBetterStack: boolean;
}

export type ILogLevel = LogLevel | string;
export enum LogLevel {
  // core log levels - available as functions
  Error = "error",
  Warn = "warn",
  Info = "info",
  Debug = "debug",

  // extra log levels - recognized when passed from logging frameworks
  Fatal = "fatal",
  Http = "http",
  Verbose = "verbose",
  Silly = "silly",
  Trace = "trace",
}

/**
 * Context type - a string/number/bool/Date, or a nested object of the same
 */
export type ContextKey = string | number | boolean | Date | null;
export type Context = { [key: string]: ContextKey | Context };
export type StackContextHint = { fileName: string, methodNames: [string] };

/**
 * Interface representing a minimal Logtail log
 */
export interface ILogtailLog {
  dt: Date;
  level: ILogLevel;
  message: string;
  [key: string]: ContextKey | Context;
}

/**
 * Middleware type, which takes a log, and returns Promise<ILogtailLog>
 */
export type Middleware = (log: ILogtailLog) => Promise<ILogtailLog>;

/**
 * Sync type, which takes a array of logs, and resolves the logs
 */
export type Sync = (logs: ILogtailLog[]) => Promise<ILogtailLog[]>;
