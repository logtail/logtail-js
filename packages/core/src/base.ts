import { ILogLevel, ILogtailLog, ILogtailOptions, Context, LogLevel, Middleware, Sync } from "@logtail/types";
import { makeBatch, makeBurstProtection, makeThrottle, calculateJsonLogSizeBytes } from "@logtail/tools";
import { serializeError } from "serialize-error";

// Types
type Message = string | Error;

// Set default options for Logtail
const defaultOptions: ILogtailOptions = {
  // Default sync endpoint (protocol + domain)
  endpoint: "https://in.logs.betterstack.com",

  // Maximum number of logs to sync in a single request to Better Stack
  batchSize: 1000,

  // Size of logs (in KiB) to trigger sync to Better Stack (0 to disable)
  batchSizeKiB: 0,

  // Max interval (in milliseconds) before a batch of logs proceeds to syncing
  batchInterval: 1000,

  // Maximum number of times to retry a failed sync request
  retryCount: 3,

  // Minimum number of milliseconds to wait before retrying a failed sync request
  retryBackoff: 100,

  // Maximum number of sync requests to make concurrently
  syncMax: 5,

  // Length of the checked window for logs burst protection in milliseconds (0 to disable)
  burstProtectionMilliseconds: 5000,

  // Maximum number of accepted logs in the specified time window (0 to disable)
  burstProtectionMax: 10000,

  // If true, errors when sending logs will be ignored
  // Has precedence over throwExceptions
  ignoreExceptions: false,

  // If true, errors when sending logs will result in a thrown exception
  throwExceptions: false,

  // Maximum depth (number of attribute levels) of a context object
  contextObjectMaxDepth: 50,

  // Produce a warn log when context object max depth is reached
  contextObjectMaxDepthWarn: true,

  // Produce a warning when circular reference is found in context object
  contextObjectCircularRefWarn: true,

  // If true, all logs will be sent to standard console output functions (console.info, console.warn, ...)
  sendLogsToConsoleOutput: false,

  // If true, all logs will be sent to Better Stack
  sendLogsToBetterStack: true,

  // Function to be used to calculate size of logs in bytes (to evaluate batchSizeLimitKiB)
  calculateLogSizeBytes: calculateJsonLogSizeBytes,
};

/**
 * Logtail core class for logging to the Better Stack service
 */
class Logtail {
  // Logtail source token
  protected _sourceToken: string;

  // Logtail library options
  protected _options: ILogtailOptions;

  // Batch function
  protected _batch: any;

  // Flush function
  protected _flush: any;

  // Log burst protection function
  protected _logBurstProtection: any;

  // Middleware
  protected _middleware: Middleware[] = [];

  // Sync function
  protected _sync?: Sync;

  // Number of logs logged
  private _countLogged = 0;

  // Number of logs successfully synced with Logtail
  private _countSynced = 0;

  // Number of logs that failed to be synced to Logtail
  private _countDropped = 0;

  /* CONSTRUCTOR */

  /**
   * Initializes a new Logtail instance
   *
   * @param sourceToken: string - Private source token for logging to Better Stack
   * @param options?: ILogtailOptions - Optionally specify Logtail options
   */
  public constructor(sourceToken: string, options?: Partial<ILogtailOptions>) {
    // First, check we have a valid source token
    if (typeof sourceToken !== "string" || sourceToken === "") {
      throw new Error("Logtail source token missing");
    }

    // Store the source token, to use for syncing with Better Stack
    this._sourceToken = sourceToken;

    // Merge default and user options
    this._options = { ...defaultOptions, ...options };

    // Create a throttler, for sync operations
    const throttle = makeThrottle(this._options.syncMax);

    // Sync after throttling
    const throttler = throttle((logs: any) => {
      return this._sync!(logs);
    });

    // Burst protection for logging
    this._logBurstProtection = makeBurstProtection(
      this._options.burstProtectionMilliseconds,
      this._options.burstProtectionMax,
      "Logging",
    );
    this.log = this._logBurstProtection(this.log.bind(this));

    // Create a batcher, for aggregating logs by buffer size/interval
    const batcher = makeBatch(
      this._options.batchSize,
      this._options.batchInterval,
      this._options.retryCount,
      this._options.retryBackoff,
      this._options.batchSizeKiB * 1024,
      this._options.calculateLogSizeBytes,
    );

    this._batch = batcher.initPusher((logs: any) => {
      return throttler(logs);
    });

    this._flush = batcher.flush;
  }

  /* PUBLIC METHODS */

  /**
   * Flush batched logs to Logtail
   */
  public async flush() {
    return this._flush();
  }

  /**
   * Number of entries logged
   *
   * @returns number
   */
  public get logged(): number {
    return this._countLogged;
  }

  /**
   * Number of log entries synced with Better Stack
   *
   * @returns number
   */
  public get synced(): number {
    return this._countSynced;
  }

  /**
   * Number of entries dropped
   *
   * @returns number
   */
  public get dropped(): number {
    return this._countDropped;
  }

  /**
   * Log an entry, to be synced with Better Stack
   *
   * @param message: string - Log message
   * @param level (LogLevel) - Level to log at (debug|info|warn|error)
   * @param context: (Context) - Context (optional)
   * @returns Promise<ILogtailLog> after syncing
   */
  public async log<TContext extends Context>(
    message: Message,
    level: ILogLevel = LogLevel.Info,
    context: TContext = {} as TContext,
  ): Promise<ILogtailLog & TContext> {
    // Wrap context in an object, if it's not already
    if (typeof context !== "object") {
      const wrappedContext: unknown = { extra: context };
      context = wrappedContext as TContext;
    }
    if (context instanceof Error) {
      const wrappedContext: unknown = { error: context };
      context = wrappedContext as TContext;
    }

    if (this._options.sendLogsToConsoleOutput) {
      switch (level) {
        case "debug":
          console.debug(message, context);
          break;
        case "info":
          console.info(message, context);
          break;
        case "warn":
          console.warn(message, context);
          break;
        case "error":
          console.error(message, context);
          break;
        default:
          console.log(`[${level.toUpperCase()}]`, message, context);
          break;
      }
    }

    // Check that we have a sync function
    if (typeof this._sync !== "function") {
      throw new Error("No Logtail logger sync function provided");
    }

    // Increment log count
    this._countLogged++;

    // Start building the log message
    let log: Partial<ILogtailLog> = {
      // Implicit date timestamp
      dt: new Date(),

      // Explicit level
      level,

      // Add initial context
      ...context,

      // Add string message or serialized error
      ...(message instanceof Error ? serializeError(message) : { message }),
    };

    let transformedLog = log as ILogtailLog | null;
    for (const middleware of this._middleware) {
      let newTransformedLog = await middleware(transformedLog as ILogtailLog);
      if (newTransformedLog == null) {
        // Don't push the log if it was filtered out in a middleware
        return transformedLog as ILogtailLog & TContext;
      }
      transformedLog = newTransformedLog;
    }

    // Manually serialize the log data
    transformedLog = this.serialize(transformedLog, this._options.contextObjectMaxDepth);

    if (!this._options.sendLogsToBetterStack) {
      // Return the resulting log before sending it
      return transformedLog as ILogtailLog & TContext;
    }

    try {
      // Push the log through the batcher, and sync
      await this._batch(transformedLog);

      // Increment sync count
      this._countSynced++;
    } catch (e) {
      // Increment dropped count
      this._countDropped++;

      // Catch any errors - re-throw if `ignoreExceptions` == false
      if (!this._options.ignoreExceptions) {
        if (this._options.throwExceptions) {
          throw e;
        } else {
          // Output to console
          console.error(e);
        }
      }
    }

    // Return the resulting log
    return transformedLog as ILogtailLog & TContext;
  }

  private serialize(value: any, maxDepth: number, visitedObjects: WeakSet<any> = new WeakSet()): any {
    if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
      return value;
    } else if (value instanceof Date) {
      // Date instances can be invalid & toISOString() will fail
      if (isNaN(value.getTime())) {
        return value.toString();
      }

      return value.toISOString();
    } else if (value instanceof Error) {
      return serializeError(value);
    } else if ((typeof value === "object" || Array.isArray(value)) && (maxDepth < 1 || visitedObjects.has(value))) {
      if (visitedObjects.has(value)) {
        if (this._options.contextObjectCircularRefWarn) {
          console.warn(
            `[Logtail] Found a circular reference when serializing logs. Please do not use circular references in your logs.`,
          );
        }
        return "<omitted circular reference>";
      }
      if (this._options.contextObjectMaxDepthWarn) {
        console.warn(
          `[Logtail] Max depth of ${this._options.contextObjectMaxDepth} reached when serializing logs. Please do not use excessive object depth in your logs.`,
        );
      }
      return `<omitted context beyond configured max depth: ${this._options.contextObjectMaxDepth}>`;
    } else if (Array.isArray(value)) {
      visitedObjects.add(value);
      const serializedArray = value.map((item) => this.serialize(item, maxDepth - 1, visitedObjects));
      visitedObjects.delete(value);

      return serializedArray;
    } else if (typeof value === "object") {
      const serializedObject: { [key: string]: any } = {};

      visitedObjects.add(value);

      Object.entries(value).forEach((item) => {
        const key = item[0];
        const value = item[1];

        const serializedValue = this.serialize(value, maxDepth - 1, visitedObjects);
        if (serializedValue !== undefined) {
          serializedObject[key] = serializedValue;
        }
      });

      visitedObjects.delete(value);

      return serializedObject;
    } else if (typeof value === "undefined") {
      return undefined;
    } else {
      return `<omitted unserializable ${typeof value}>`;
    }
  }

  /**
   *
   * Debug level log, to be synced with Better Stack
   *
   * @param message: string - Log message
   * @param context: (Pick<ILogtailLog, "context">) - Context (optional)
   * @returns Promise<ILogtailLog> after syncing
   */
  public async debug<TContext extends Context>(message: Message, context: TContext = {} as TContext) {
    return this.log(message, LogLevel.Debug, context);
  }

  /**
   *
   * Info level log, to be synced with Better Stack
   *
   * @param message: string - Log message
   * @param context: (Pick<ILogtailLog, "context">) - Context (optional)
   * @returns Promise<ILogtailLog> after syncing
   */
  public async info<TContext extends Context>(message: Message, context: TContext = {} as TContext) {
    return this.log(message, LogLevel.Info, context);
  }

  /**
   *
   * Warning level log, to be synced with Better Stack
   *
   * @param message: string - Log message
   * @param context: (Pick<ILogtailLog, "context">) - Context (optional)
   * @returns Promise<ILogtailLog> after syncing
   */
  public async warn<TContext extends Context>(message: Message, context: TContext = {} as TContext) {
    return this.log(message, LogLevel.Warn, context);
  }

  /**
   *
   * Warning level log, to be synced with Better Stack
   *
   * @param message: string - Log message
   * @param context: (Pick<ILogtailLog, "context">) - Context (optional)
   * @returns Promise<ILogtailLog> after syncing
   */
  public async error<TContext extends Context>(message: Message, context: TContext = {} as TContext) {
    return this.log(message, LogLevel.Error, context);
  }

  /**
   * Sets the sync method - i.e. the final step in the pipeline to get logs
   * over to Better Stack
   *
   * @param fn - Pipeline function to use as sync method
   */
  public setSync(fn: Sync): void {
    this._sync = fn;
  }

  /**
   * Add a middleware function to the logging pipeline
   *
   * @param fn - Function to add to the log pipeline
   * @returns void
   */
  public use(fn: Middleware): void {
    this._middleware.push(fn);
  }

  /**
   * Remove a function from the pipeline
   *
   * @param fn - Pipeline function
   * @returns void
   */
  public remove(fn: Middleware): void {
    this._middleware = this._middleware.filter((p) => p !== fn);
  }
}

export default class extends Logtail {
  async log<TContext extends Context>(
    message: Message,
    level: ILogLevel = LogLevel.Info,
    context: TContext = {} as TContext,
  ): Promise<ILogtailLog & TContext> {
    return super.log(message, level, context);
  }
}
