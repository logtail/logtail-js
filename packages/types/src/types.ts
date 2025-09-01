/**
 * Logtail library options
 */

export interface ILogtailOptions {
  /**
   * Endpoint URL for syncing logs with Better Stack
   */
  endpoint: string;

  /**
   * Maximum number of logs to sync in a single request to Better Stack
   */
  batchSize: number;

  /**
   * Size of logs (in KiB) to trigger sync to Better Stack (0 to disable)
   */
  batchSizeKiB: number;

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
   * Maximum number of sync requests that can be queued when all concurrent slots are busy.
   * When the queue limit is reached, new logs will be dropped. (-1 for unlimited queue)
   */
  syncQueuedMax: number;

  /**
   * Length of the checked window for logs burst protection in milliseconds (0 to disable)
   */
  burstProtectionMilliseconds: number;

  /**
   * Maximum number of accepted logs in the specified time window (0 to disable)
   */
  burstProtectionMax: number;

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

  /**
   * Function to be used to calculate size of logs in bytes (to evaluate batchSizeKiB). JSON length by default.
   **/
  calculateLogSizeBytes: (logs: ILogtailLog) => number;
}

export interface ILogtailNodeOptions extends ILogtailOptions {
  /**
   * Use IPv6 for sending logs to Better Stack. Enable this if you are running on nodejs in an IPv6-only network.
   */
  useIPv6: boolean;

  /**
   * Request timeout in milliseconds for HTTP requests to Better Stack (0 to disable).
   */
  timeout: number;
}

export interface ILogtailEdgeOptions extends ILogtailOptions {
  /**
   * Boolean to produce a warning when ExecutionContext hasn't been passed to the `log` method
   **/
  warnAboutMissingExecutionContext: boolean;
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
 * Context type - a nested object of serializable types (a string / number / bool / null / undefined / Array / Date / Error)
 */
export type ContextKey = any;
export type Context = { [key: string]: ContextKey };
export type StackContextHint = { fileName: string; methodNames: string[]; required?: true };

/**
 * Interface representing a minimal Logtail log
 */
export interface ILogtailLog {
  dt: Date;
  level: ILogLevel;
  message: string;
  [key: string]: ContextKey;
}

/**
 * Middleware type, which takes a log, and returns Promise<ILogtailLog>
 */
export type Middleware = (log: ILogtailLog) => Promise<ILogtailLog>;

/**
 * Sync type, which takes a array of logs, and resolves the logs
 */
export type Sync = (logs: ILogtailLog[]) => Promise<ILogtailLog[]>;
