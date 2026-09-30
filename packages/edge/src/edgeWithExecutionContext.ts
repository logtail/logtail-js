import { Context, ILogLevel, ILogtailLog, LogLevel } from "@logtail/types";

import { Edge } from "./edge";
import type { ExecutionContext } from "./executionContext";

// Types
type Message = string | Error;

export class EdgeWithExecutionContext {
  public readonly logger: Edge;

  public readonly ctx: ExecutionContext;

  // True while a flush is scheduled for the current tick of this request
  private flushScheduled = false;

  public constructor(logger: Edge, ctx: ExecutionContext) {
    this.logger = logger;
    this.ctx = ctx;
  }

  public async log<TContext extends Context>(
    message: string | Error,
    level?: ILogLevel,
    context: any = {} as TContext,
  ): Promise<ILogtailLog & TContext> {
    const log = this.logger.log<TContext>(message, level, context, this.ctx);
    this.scheduleFlush();
    return log;
  }

  public async debug<TContext extends Context>(
    message: Message,
    context: TContext = {} as TContext,
  ): Promise<ILogtailLog & TContext> {
    return this.log<TContext>(message, LogLevel.Debug, context);
  }

  public async info<TContext extends Context>(
    message: Message,
    context: TContext = {} as TContext,
  ): Promise<ILogtailLog & TContext> {
    return this.log<TContext>(message, LogLevel.Info, context);
  }

  public async warn<TContext extends Context>(
    message: Message,
    context: TContext = {} as TContext,
  ): Promise<ILogtailLog & TContext> {
    return this.log<TContext>(message, LogLevel.Warn, context);
  }

  public async error<TContext extends Context>(
    message: Message,
    context: TContext = {} as TContext,
  ): Promise<ILogtailLog & TContext> {
    return this.log<TContext>(message, LogLevel.Error, context);
  }

  /**
   * Sends this request's logs once the current tick ends, so the request is not kept alive for the batch
   * interval and no batch timer outlives the request that started it. Logs made in the same tick share
   * one send; logs made after an await get a send of their own.
   */
  private scheduleFlush(): void {
    if (this.flushScheduled) {
      return;
    }

    this.flushScheduled = true;
    this.ctx.waitUntil(
      Promise.resolve().then(() => {
        this.flushScheduled = false;
        return this.logger.flush();
      }),
    );
  }
}
