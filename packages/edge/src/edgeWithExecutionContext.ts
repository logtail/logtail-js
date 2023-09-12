import { Context, ILogLevel, ILogtailLog } from "@logtail/types";

import { ExecutionContext } from "@cloudflare/workers-types";

import { Edge } from "./edge";

// Types
type Message = string | Error;

export class EdgeWithExecutionContext {
  public readonly logger: Edge;

  public readonly ctx: ExecutionContext;

  public constructor(logger: Edge, ctx: ExecutionContext) {
    this.logger = logger;
    this.ctx = ctx;
  }

  public async log<TContext extends Context>(
    message: string | Error,
    level?: ILogLevel,
    context: any = {} as TContext,
  ): Promise<ILogtailLog & TContext> {
    return this.logger.log<TContext>(message, level, context, this.ctx);
  }

  public async debug<TContext extends Context>(
    message: Message,
    context: TContext = {} as TContext,
  ): Promise<ILogtailLog & TContext> {
    return this.logger.debug<TContext>(message, context, this.ctx);
  }

  public async info<TContext extends Context>(
    message: Message,
    context: TContext = {} as TContext,
  ): Promise<ILogtailLog & TContext> {
    return this.logger.info<TContext>(message, context, this.ctx);
  }

  public async warn<TContext extends Context>(
    message: Message,
    context: TContext = {} as TContext,
  ): Promise<ILogtailLog & TContext> {
    return this.logger.warn<TContext>(message, context, this.ctx);
  }

  public async error<TContext extends Context>(
    message: Message,
    context: TContext = {} as TContext,
  ): Promise<ILogtailLog & TContext> {
    return this.logger.error<TContext>(message, context, this.ctx);
  }
}
