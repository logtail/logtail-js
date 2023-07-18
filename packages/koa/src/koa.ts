import { Logtail } from "@logtail/node";
import { ILogtailOptions, LogLevel } from "@logtail/types";
import Koa, { Context } from "koa";
import { path } from "rambda";

interface IKoaOptions {
  /**
   * Properties to pluck from the Koa `Context` object
   */
  contextPaths: string[];

  /**
   * urls to exclude from logging
   */
  excludedRoutes: string[];

  /**
   * HTTP Methods to exclude from logging
   */
  excludedMethods: string[];

  /**
   * Logs with lower level than `level` will be excluded
   */
  level: LogLevel;

  /**
   * Route Message customization
   */
  messageFormatter(ctx: Context): string;

  /**
   * Error Message customization
   */
  errorMessageFormatter(ctx: Context, error: Error): string;
}

const defaultKoaOpt: IKoaOptions = {
  contextPaths: [
    "statusCode",
    "request.headers",
    "request.method",
    "request.length",
    "request.url",
    "request.query"
  ],
  excludedRoutes: [],
  excludedMethods: [],
  level: LogLevel.Info,
  messageFormatter: ctx => `Koa HTTP request: ${ctx.status}`,
  errorMessageFormatter: (ctx, e) =>
    `Koa HTTP request error: ${(typeof e === "object" && e.message) || e}`
};

class KoaLogtail extends Logtail {
  protected _koaOptions: IKoaOptions;

  public constructor(
    sourceToken: string,
    logtailOpt?: Partial<ILogtailOptions>,
    koaOpt?: Partial<IKoaOptions>
  ) {
    super(sourceToken, logtailOpt);

    // Set Koa-specific logging options
    this._koaOptions = { ...defaultKoaOpt, ...koaOpt };
  }

  /**
   * Returns an object containing Koa request data, from Context
   * @param ctx - Koa Context
   */
  private _fromContext(ctx: Context) {
    const context = {};

    this._koaOptions.contextPaths.forEach(p => {
      // @ts-ignore
      context[p] = path(p, ctx);
    });

    return context;
  }

  /**
   * Koa middleware handler
   *
   * @param ctx - Koa context
   * @param next - Function to invoke the next middleware in the pipeline
   */
  private middleware = async (ctx: Context, next: () => Promise<void>) => {
    // By default, use the 'info' log level
    let logLevel: LogLevel = LogLevel.Info;

    let msg: string;

    try {
      // Call downstream middleware
      await next();

      // If not thrown, middleware executed successfully
      msg = this._koaOptions.messageFormatter(ctx);

      // 4xx | 5xx status codes should be considered a warning
      if (ctx.status.toString().startsWith("4")) {
        logLevel = LogLevel.Warn;
      } else if (ctx.status.toString().startsWith("5")) {
        logLevel = LogLevel.Error;
      }
    } catch (e) {
      // Error was thrown in middleware / HTTP request handling
      logLevel = LogLevel.Error;
      msg = this._koaOptions.errorMessageFormatter(ctx, e);
    } finally {
      // Finally, log to the correct log level
      if (
        !this._koaOptions.excludedMethods.includes(ctx.request.method) &&
        !this._koaOptions.excludedRoutes.includes(ctx.request.url) &&
        this._toLevelNumber(logLevel) >= this._toLevelNumber(this._koaOptions.level)
      ) {
        void this[logLevel](msg!, this._fromContext(ctx));
      }
    }
  };

  /**
   * Attach Logtail's Koa middleware handler to a Koa instance
   *
   * @param koa - an instance of Koa
   */
  public attach(koa: Koa): this {
    koa.use(this.middleware);
    return this;
  }

  private _toLevelNumber(level: LogLevel): number {
    const map = {
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

    return map[level];
  }

  /**
   * Sets minimal log level to be logged.
   */
  public setLevel(level: LogLevel): this {
    this._koaOptions.level = level
    return this;
  }
}

export default KoaLogtail;
