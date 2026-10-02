import { encode } from "@msgpack/msgpack";

import { Context, ILogLevel, ILogtailLog, ILogtailEdgeOptions, LogLevel } from "@logtail/types";
import { Base } from "@logtail/core";

import { getStackContext } from "./context";
import type { ExecutionContext } from "./executionContext";
import { EdgeWithExecutionContext } from "./edgeWithExecutionContext";

// Types
type Message = string | Error;

export class Edge extends Base {
  private _warnedAboutMissingCtx: Boolean = false;

  private readonly warnAboutMissingExecutionContext: Boolean;

  public constructor(sourceToken: string, options?: Partial<ILogtailEdgeOptions>) {
    // Sends are not throttled by default: each request sends its own logs and must never wait on another
    // request's send, since a runtime like workerd cancels a request left waiting without I/O of its own
    super(sourceToken, { syncMax: Infinity, ...options });

    this.warnAboutMissingExecutionContext = options?.warnAboutMissingExecutionContext ?? true;

    // Sync function
    const sync = async (logs: ILogtailLog[]): Promise<ILogtailLog[]> => {
      // Compress the data using CompressionStream
      const compressedData = await new Response(
        new Blob([this.encodeAsMsgpack(logs)]).stream().pipeThrough(new CompressionStream("gzip")),
      ).arrayBuffer();

      const res = await fetch(this._options.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/msgpack",
          "Content-Encoding": "gzip",
          Authorization: `Bearer ${this._sourceToken}`,
          "User-Agent": "logtail-js(edge)",
        },
        body: compressedData,
      });

      if (res.ok) {
        return logs;
      }

      throw new Error(res.statusText);
    };

    // Set the throttled sync function
    this.setSync(sync);
  }

  public withExecutionContext(ctx: ExecutionContext): EdgeWithExecutionContext {
    return new EdgeWithExecutionContext(this, ctx);
  }

  /**
   * @param message (string | Error) - Log message
   * @param level (ILogLevel) - Level to log at (debug|info|warn|error)
   * @param context (Context | Error | any) - Log context for passing structured data
   * @param ctx (ExecutionContext) - Execution context of particular worker request
   * @returns Promise<ILogtailLog> after syncing
   */
  public async log<TContext extends Context>(
    message: Message,
    level?: ILogLevel,
    context: any = {} as TContext,
    ctx?: ExecutionContext,
  ): Promise<ILogtailLog & TContext> {
    // Only capture stack context if enabled (default: true)
    const stackContext = this._options.captureStackContext !== false ? getStackContext(this) : {};
    context = { ...stackContext, ...context };

    // Process/sync the log, per `Base` logic
    let buffered!: () => void;
    const reachedBuffer = new Promise<void>((resolve) => (buffered = resolve));
    const log = this._log(message, level, context, buffered);

    if (ctx) {
      // The request is kept alive until its own log is sent or dropped, retries included
      ctx.waitUntil(log);
      // Send the log as soon as it is in the batch buffer, so the request is not kept alive for the batch interval
      // and no batch timer outlives it; logs reaching the buffer in the same tick share one send. The request does
      // not wait for the flush, which also waits for the other logs it sends, e.g. other requests' logs to retry
      reachedBuffer.then(() => this.flush());
    } else if (this.warnAboutMissingExecutionContext && !this._warnedAboutMissingCtx) {
      this._warnedAboutMissingCtx = true;

      const warningMessage =
        "ExecutionContext hasn't been passed to the `log` method, which means syncing logs cannot be guaranteed. " +
        "To ensure your logs will reach Better Stack, use `logger.withExecutionContext(ctx)` to log in your handler function. " +
        "See https://betterstack.com/docs/logs/js-edge-execution-context/ for details.";
      console.warn(warningMessage);
      this.log(warningMessage, LogLevel.Warn, stackContext).catch(() => {});

      // Flush immediately to ensure warning will get sent to Better Stack
      await this.flush();
    }

    // Return the transformed log
    return (await log) as ILogtailLog & TContext;
  }

  public async debug<TContext extends Context>(
    message: Message,
    context: TContext = {} as TContext,
    ctx?: ExecutionContext,
  ): Promise<ILogtailLog & TContext> {
    return this.log<TContext>(message, LogLevel.Debug, context, ctx);
  }

  public async info<TContext extends Context>(
    message: Message,
    context: TContext = {} as TContext,
    ctx?: ExecutionContext,
  ): Promise<ILogtailLog & TContext> {
    return this.log<TContext>(message, LogLevel.Info, context, ctx);
  }

  public async warn<TContext extends Context>(
    message: Message,
    context: TContext = {} as TContext,
    ctx?: ExecutionContext,
  ): Promise<ILogtailLog & TContext> {
    return this.log<TContext>(message, LogLevel.Warn, context, ctx);
  }

  public async error<TContext extends Context>(
    message: Message,
    context: TContext = {} as TContext,
    ctx?: ExecutionContext,
  ): Promise<ILogtailLog & TContext> {
    return this.log<TContext>(message, LogLevel.Error, context, ctx);
  }

  private encodeAsMsgpack(logs: ILogtailLog[]): Uint8Array {
    const encoded = encode(logs);

    return new Uint8Array(encoded.buffer, encoded.byteOffset, encoded.byteLength);
  }
}
