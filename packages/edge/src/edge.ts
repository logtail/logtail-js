import { encode } from "@msgpack/msgpack";

import { Context, ILogLevel, ILogtailLog, ILogtailEdgeOptions, LogLevel } from "@logtail/types";
import { Base } from "@logtail/core";

import type { ExecutionContext } from "@cloudflare/workers-types";

import { getStackContext } from "./context";
import { EdgeWithExecutionContext } from "./edgeWithExecutionContext";

// Types
type Message = string | Error;

export class Edge extends Base {
  private _warnedAboutMissingCtx: Boolean = false;

  private readonly warnAboutMissingExecutionContext: Boolean;

  public constructor(sourceToken: string, options?: Partial<ILogtailEdgeOptions>) {
    super(sourceToken, options);

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
    // Process/sync the log, per `Base` logic
    const stackContext = getStackContext(this);
    context = { ...stackContext, ...context };
    const log = super.log(message, level, context);

    if (ctx) {
      ctx.waitUntil(log);
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
