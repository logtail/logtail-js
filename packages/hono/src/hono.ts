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
   * Builds the message of a request log when the handler threw
   */
  errorMessageFormatter(c: HonoContext, error: unknown): string;

  /**
   * Builds the context of a request log; `status` and `duration_ms` are added on top
   */
  contextFormatter(c: HonoContext): Context;
}

const defaultOptions: IHonoLogtailOptions = {
  excludedRoutes: [],
  excludedMethods: [],
  level: LogLevel.Info,
  messageFormatter: (c) => `Hono HTTP request: ${c.res.status}`,
  errorMessageFormatter: (c, error) => `Hono HTTP request error: ${error instanceof Error ? error.message : error}`,
  contextFormatter: (c) => ({
    method: c.req.method,
    url: c.req.url,
    path: c.req.path,
    route: c.req.routePath,
    query: c.req.query(),
    user_agent: c.req.header("user-agent"),
  }),
};

const levelNumbers: Record<LogLevel, number> = {
  [LogLevel.Fatal]: 6,
  [LogLevel.Error]: 5,
  [LogLevel.Http]: 5,
  [LogLevel.Warn]: 4,
  [LogLevel.Info]: 3,
  [LogLevel.Debug]: 2,
  [LogLevel.Verbose]: 1,
  [LogLevel.Silly]: 1,
  [LogLevel.Trace]: 1,
};

/**
 * Creates a Hono middleware logging every handled request to Better Stack once the response is ready:
 * 2xx and 3xx responses at info level, 4xx at warn and 5xx at error. Errors thrown by handlers are logged
 * with the status Hono's error handler responded with and with the error in the context.
 *
 * @param logger - Better Stack logger, or a function returning the logger to use for a request
 * @param options - Logging options
 */
export function logtail(
  logger: ILogtailLogger | ((c: HonoContext) => ILogtailLogger),
  options?: Partial<IHonoLogtailOptions>,
): MiddlewareHandler {
  const honoOptions: IHonoLogtailOptions = { ...defaultOptions, ...options };

  return async (c, next) => {
    const startedAt = Date.now();
    let status: number;
    let error: unknown;
    let escaped = false;

    try {
      await next();
      // Hono's error handler has already turned a thrown error into the response by now
      status = c.res.status;
      error = c.error;
    } catch (thrown) {
      // The error escaped Hono's error handling, e.g. it is not an Error instance
      status =
        typeof (thrown as { status?: unknown })?.status === "number" ? (thrown as { status: number }).status : 500;
      error = thrown;
      escaped = true;
    }

    const message = error === undefined ? honoOptions.messageFormatter(c) : honoOptions.errorMessageFormatter(c, error);
    const level = status >= 500 ? LogLevel.Error : status >= 400 ? LogLevel.Warn : LogLevel.Info;

    if (
      !honoOptions.excludedMethods.includes(c.req.method) &&
      !honoOptions.excludedRoutes.includes(c.req.path) &&
      levelNumbers[level] >= levelNumbers[honoOptions.level]
    ) {
      const context: Context = { ...honoOptions.contextFormatter(c), status, duration_ms: Date.now() - startedAt };
      if (error !== undefined) {
        context.error = error;
      }
      void requestLogger(logger, c).log(message, level, context);
    }

    if (escaped) {
      throw error;
    }
  };
}

/**
 * Resolves the logger for a request, bound to the request's execution context on runtimes that have one
 * (Cloudflare Workers) so the log is delivered after the response is sent
 */
function requestLogger(logger: ILogtailLogger | ((c: HonoContext) => ILogtailLogger), c: HonoContext): ILogtailLogger {
  const instance = typeof logger === "function" ? logger(c) : logger;
  if (!instance.withExecutionContext) {
    return instance;
  }

  let executionCtx;
  try {
    executionCtx = c.executionCtx;
  } catch (_) {
    // Hono throws where there is no execution context, like Node.js or Bun
    return instance;
  }

  return instance.withExecutionContext(executionCtx);
}
