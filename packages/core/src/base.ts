import {
  ILogtailLog,
  ILogtailOptions,
  Context,
  LogLevel,
  Middleware,
  Sync
} from "@logtail/types";
import { makeBatch, makeThrottle } from "@logtail/tools";

// Types
type Message = string | Error;

// Set default options for Logtail
const defaultOptions: ILogtailOptions = {
  // Default sync endpoint (protocol + domain)
  endpoint: "https://in.logtail.com",

  // Maximum number of logs to sync in a single request to Logtail.com
  batchSize: 1000,

  // Max interval (in milliseconds) before a batch of logs proceeds to syncing
  batchInterval: 1000,

  // Maximum number of sync requests to make concurrently
  syncMax: 5,

  // If true, errors/failed logs should be ignored
  ignoreExceptions: true,

  // maximum depth (number of attribute levels) of a context object
  contextObjectMaxDepth: 50,

  // produce a warn log when context object max depth is reached
  contextObjectMaxDepthWarn: true
};

/**
 * Logtail core class for logging to the Logtail.com service
 */
class Logtail {
  // Logtail source token
  protected _sourceToken: string;

  // Logtail library options
  protected _options: ILogtailOptions;

  // Batch function
  protected _batch: any;

  // Middleware
  protected _middleware: Middleware[] = [];

  // Sync function
  protected _sync?: Sync;

  // Number of logs logged
  private _countLogged = 0;

  // Number of logs successfully synced with Logtail
  private _countSynced = 0;

  /* CONSTRUCTOR */

  /**
   * Initializes a new Logtail instance
   *
   * @param sourceToken: string - Private source token for logging to Logtail.com
   * @param options?: ILogtailOptions - Optionally specify Logtail options
   */
  public constructor(
    sourceToken: string,
    options?: Partial<ILogtailOptions>
  ) {
    // First, check we have a valid source token
    if (typeof sourceToken !== "string" || sourceToken === "") {
      throw new Error("Logtail source token missing");
    }

    // Store the source token, to use for syncing with Logtail.com
    this._sourceToken = sourceToken;

    // Merge default and user options
    this._options = { ...defaultOptions, ...options };

    // Create a throttler, for sync operations
    const throttle = makeThrottle(this._options.syncMax);

    // Sync after throttling
    const throttler = throttle((logs: any) => {
      return this._sync!(logs);
    });

    // Create a batcher, for aggregating logs by buffer size/interval
    const batcher = makeBatch(
      this._options.batchSize,
      this._options.batchInterval
    );

    this._batch = batcher((logs: any) => {
      return throttler(logs);
    });
  }

  /* PRIVATE METHODS */
  private getContextFromError(e: Error) {
    return {
      stack: e.stack
    };
  }

  /* PUBLIC METHODS */

  /**
   * Number of entries logged
   *
   * @returns number
   */
  public get logged(): number {
    return this._countLogged;
  }

  /**
   * Number of log entries synced with Logtail.com
   *
   * @returns number
   */
  public get synced(): number {
    return this._countSynced;
  }

  /**
   * Log an entry, to be synced with Logtail.com
   *
   * @param message: string - Log message
   * @param level (LogLevel) - Level to log at (debug|info|warn|error)
   * @param context: (Context) - Context (optional)
   * @returns Promise<ILogtailLog> after syncing
   */
  public async log<TContext extends Context>(
    message: Message,
    level: LogLevel = LogLevel.Info,
    context: TContext = {} as TContext
  ): Promise<ILogtailLog & TContext> {
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
      ...context
    };

    // Determine the type of message...

    // Is this an error?
    if (message instanceof Error) {
      log = {
        // Add stub
        ...log,

        // Add stack trace
        ...this.getContextFromError(message),

        // Add error message
        message: message.message
      };
    } else {
      log = {
        // Add stub
        ...log,

        // Add string message
        message
      };
    }

    let transformedLog = log as ILogtailLog | null;
    for (const middleware of this._middleware) {
      let newTransformedLog = await middleware(transformedLog as ILogtailLog);
      if (newTransformedLog == null) {
        // Don't push the log if it was filtered out in a middleware
        return transformedLog as ILogtailLog & TContext;
      }
      transformedLog = newTransformedLog;
    }

    try {
      // Push the log through the batcher, and sync
      await this._batch(transformedLog);

      // Increment sync count
      this._countSynced++;
    } catch (e) {
      // Catch any errors - re-throw if `ignoreExceptions` == false
      if (!this._options.ignoreExceptions) {
        throw e;
      } else {
        console.error(e);
      }
    }

    // Return the resulting log
    return transformedLog as ILogtailLog & TContext;
  }

  /**
   *
   * Debug level log, to be synced with Logtail.com
   *
   * @param message: string - Log message
   * @param context: (Pick<ILogtailLog, "context">) - Context (optional)
   * @returns Promise<ILogtailLog> after syncing
   */
  public async debug<TContext extends Context>(
    message: Message,
    context: TContext = {} as TContext
  ) {
    return this.log(message, LogLevel.Debug, context);
  }

  /**
   *
   * Info level log, to be synced with Logtail.com
   *
   * @param message: string - Log message
   * @param context: (Pick<ILogtailLog, "context">) - Context (optional)
   * @returns Promise<ILogtailLog> after syncing
   */
  public async info<TContext extends Context>(
    message: Message,
    context: TContext = {} as TContext
  ) {
    return this.log(message, LogLevel.Info, context);
  }

  /**
   *
   * Warning level log, to be synced with Logtail.com
   *
   * @param message: string - Log message
   * @param context: (Pick<ILogtailLog, "context">) - Context (optional)
   * @returns Promise<ILogtailLog> after syncing
   */
  public async warn<TContext extends Context>(
    message: Message,
    context: TContext = {} as TContext
  ) {
    return this.log(message, LogLevel.Warn, context);
  }

  /**
   *
   * Warning level log, to be synced with Logtail.com
   *
   * @param message: string - Log message
   * @param context: (Pick<ILogtailLog, "context">) - Context (optional)
   * @returns Promise<ILogtailLog> after syncing
   */
  public async error<TContext extends Context>(
    message: Message,
    context: TContext = {} as TContext
  ) {
    return this.log(message, LogLevel.Error, context);
  }

  /**
   * Sets the sync method - i.e. the final step in the pipeline to get logs
   * over to Logtail.com
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
    this._middleware = this._middleware.filter(p => p !== fn);
  }
}

// noinspection JSUnusedGlobalSymbols
export default Logtail;
