import { encode } from "@msgpack/msgpack";

import {
  Context,
  ILogLevel,
  ILogtailLog,
  ILogtailEdgeOptions,
  LogLevel,
} from "@logtail/types";
import { Base } from "@logtail/core";

import { ExecutionContext } from "@cloudflare/workers-types";

import { getStackContext } from "./context";
import { EdgeWithExecutionContext } from "./edgeWithExecutionContext";

// Types
type Message = string | Error;

export class Edge extends Base {
  private _warnedAboutMissingCtx: Boolean = false;

  private readonly warnAboutMissingExecutionContext: Boolean;

  public constructor(
    sourceToken: string,
    options?: Partial<ILogtailEdgeOptions>,
  ) {
    super(sourceToken, options);

    this.warnAboutMissingExecutionContext =
      options?.warnAboutMissingExecutionContext ?? true;

    // Sync function
    const sync = async (logs: ILogtailLog[]): Promise<ILogtailLog[]> => {
      const res = await fetch(this._options.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/msgpack",
          Authorization: `Bearer ${this._sourceToken}`,
          "User-Agent": "logtail-js(edge)",
        },
        body: this.encodeAsMsgpack(logs),
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
    // Wrap context in an object, if it's not already
    if (typeof context !== "object") {
      const wrappedContext: unknown = { extra: context };
      context = wrappedContext as TContext;
    }
    if (context instanceof Error) {
      const wrappedContext: unknown = { error: context };
      context = wrappedContext as TContext;
    }

    // Process/sync the log, per `Base` logic
    const stackContext = getStackContext(this);
    context = { ...stackContext, ...context };
    const log = super.log(message, level, context);

    if (ctx) {
      ctx.waitUntil(log);
    } else if (
      this.warnAboutMissingExecutionContext &&
      !this._warnedAboutMissingCtx
    ) {
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
    const maxDepth = this._options.contextObjectMaxDepth;
    const logsWithISODateFormat = logs.map(log => ({
      ...this.sanitizeForEncoding(log, maxDepth),
      dt: log.dt.toISOString(),
    }));
    const encoded = encode(logsWithISODateFormat);

    return new Uint8Array(
      encoded.buffer,
      encoded.byteOffset,
      encoded.byteLength,
    );
  }

  private sanitizeForEncoding(
    value: any,
    maxDepth: number,
    visitedObjects: WeakSet<any> = new WeakSet(),
  ): any {
    if (
      value === null ||
      typeof value === "boolean" ||
      typeof value === "number" ||
      typeof value === "string"
    ) {
      return value;
    } else if (value instanceof Date) {
      // Date instances can be invalid & toISOString() will fail
      if (isNaN(value.getTime())) {
        return value.toString();
      }

      return value.toISOString();
    } else if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack?.split("\n"),
      };
    } else if (
      (typeof value === "object" || Array.isArray(value)) &&
      (maxDepth < 1 || visitedObjects.has(value))
    ) {
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
      const sanitizedArray = value.map(item =>
        this.sanitizeForEncoding(item, maxDepth - 1, visitedObjects),
      );
      visitedObjects.delete(value);

      return sanitizedArray;
    } else if (typeof value === "object") {
      const logClone: { [key: string]: any } = {};

      visitedObjects.add(value);

      Object.entries(value).forEach(item => {
        const key = item[0];
        const value = item[1];

        const result = this.sanitizeForEncoding(
          value,
          maxDepth - 1,
          visitedObjects,
        );
        if (result !== undefined) {
          logClone[key] = result;
        }
      });

      visitedObjects.delete(value);

      return logClone;
    } else if (typeof value === "undefined") {
      return undefined;
    } else {
      return `<omitted unserializable ${typeof value}>`;
    }
  }
}
