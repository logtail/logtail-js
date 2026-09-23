import type { Context as HonoContext, MiddlewareHandler } from "hono";

import { Context, ILogLevel, LogLevel } from "@logtail/types";

/**
 * Any Better Stack logger: `@logtail/node`, `@logtail/edge` or `@logtail/browser` instances, and the
 * wrapper returned by `@logtail/edge`'s `withExecutionContext()`
 */
export interface ILogtailLogger {
  log(message: string, level?: ILogLevel, context?: Context): Promise<unknown>;
  withExecutionContext?(ctx: { waitUntil(promise: Promise<unknown>): void }): ILogtailLogger;
}

export interface IHonoLogtailOptions {
  /**
   * Request paths to exclude from logging
   */
  excludedRoutes: string[];

  /**
   * HTTP methods to exclude from logging
   */
  excludedMethods: string[];

  /**
   * Requests logged with a lower level than `level` are excluded
   */
  level: LogLevel;

  /**
   * Builds the message of a request log
   */
  messageFormatter(c: HonoContext): string;

  /**
   * Builds the message of a request log when the handler throws
   */
  errorMessageFormatter(c: HonoContext, error: unknown): string;

  /**
   * Builds the context of a request log; `status` and `duration_ms` are added on top
   */
  contextFormatter(c: HonoContext): Context;
}

/**
 * Creates a Hono middleware logging every handled request to Better Stack
 *
 * @param logger - Better Stack logger, or a function returning the logger to use for a request
 * @param options - Logging options
 */
export function logtail(
  logger: ILogtailLogger | ((c: HonoContext) => ILogtailLogger),
  options?: Partial<IHonoLogtailOptions>,
): MiddlewareHandler {
  throw new Error("Not implemented");
}
