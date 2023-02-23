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
   * Maximum number of sync requests to make concurrently (useful to limit
   * network I/O)
   */
  syncMax: number;

  /**
   * Boolean to specify whether thrown errors/failed logs should be ignored
   */
  ignoreExceptions: boolean;


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
