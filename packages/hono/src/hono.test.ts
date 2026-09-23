import { Context, Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { Logtail as EdgeLogtail } from "@logtail/edge";
import { Logtail } from "@logtail/node";
import { ILogtailLog, LogLevel } from "@logtail/types";

import { IHonoLogtailOptions, logtail } from "./hono";

function getLogger() {
  const logger = new Logtail("test", { throwExceptions: true });
  const logs: ILogtailLog[] = [];
  logger.setSync(async (batch) => {
    logs.push(...batch);
    return batch;
  });
  return { logger, logs };
}

function getApp(options?: Partial<IHonoLogtailOptions>) {
  const { logger, logs } = getLogger();
  const app = new Hono();
  app.use(logtail(logger, options));
  app.get("/ping", (c) => c.text("pong"));
  app.get("/users/:id", (c) => c.json({ id: c.req.param("id") }));
  app.get("/unauthorized", (c) => c.text("Unauthorized", 401));
  app.get("/internal_error", (c) => c.text("Internal server error", 500));
  app.get("/throw", () => {
    throw new Error("Error from handler");
  });
  app.get("/forbidden", () => {
    throw new HTTPException(403, { message: "Forbidden" });
  });
  return { app, logger, logs };
}

describe("Hono Logtail middleware", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should log a successful request at info level with the request context", async () => {
    const { app, logger, logs } = getApp();

    const response = await app.request("/users/42?verbose=1", { headers: { "user-agent": "jest" } });
    await logger.flush();

    expect(response.status).toBe(200);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      level: LogLevel.Info,
      message: "Hono HTTP request: 200",
      method: "GET",
      url: "http://localhost/users/42?verbose=1",
      path: "/users/42",
      route: "/users/:id",
      query: { verbose: "1" },
      status: 200,
      user_agent: "jest",
    });
    expect(typeof logs[0].duration_ms).toBe("number");
  });

  it("should log 4xx responses at warn level", async () => {
    const { app, logger, logs } = getApp();

    await app.request("/unauthorized");
    await app.request("/not_found");
    await logger.flush();

    expect(logs.map((log) => [log.level, log.message, log.status])).toEqual([
      [LogLevel.Warn, "Hono HTTP request: 401", 401],
      [LogLevel.Warn, "Hono HTTP request: 404", 404],
    ]);
  });

  it("should log 5xx responses at error level", async () => {
    const { app, logger, logs } = getApp();

    await app.request("/internal_error");
    await logger.flush();

    expect(logs.map((log) => [log.level, log.message, log.status])).toEqual([
      [LogLevel.Error, "Hono HTTP request: 500", 500],
    ]);
  });

  it("should log thrown errors at error level and leave them to Hono", async () => {
    const { app, logger, logs } = getApp();
    jest.spyOn(console, "error").mockImplementation(() => {});

    const response = await app.request("/throw");
    await logger.flush();

    expect(response.status).toBe(500);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      level: LogLevel.Error,
      message: "Hono HTTP request error: Error from handler",
      status: 500,
      error: { name: "Error", message: "Error from handler" },
    });
  });

  it("should use the status of a thrown HTTPException", async () => {
    const { app, logger, logs } = getApp();

    const response = await app.request("/forbidden");
    await logger.flush();

    expect(response.status).toBe(403);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      level: LogLevel.Warn,
      message: "Hono HTTP request error: Forbidden",
      status: 403,
    });
  });

  it("should skip excluded routes and methods", async () => {
    const { app, logger, logs } = getApp({ excludedRoutes: ["/ping"], excludedMethods: ["POST"] });

    await app.request("/ping");
    await app.request("/users/1", { method: "POST" });
    await app.request("/users/1");
    await logger.flush();

    expect(logs.map((log) => log.path)).toEqual(["/users/1"]);
  });

  it("should skip requests below the configured level", async () => {
    const { app, logger, logs } = getApp({ level: LogLevel.Warn });

    await app.request("/ping");
    await app.request("/unauthorized");
    await logger.flush();

    expect(logs.map((log) => log.status)).toEqual([401]);
  });

  it("should accept custom message and context formatters", async () => {
    const { app, logger, logs } = getApp({
      messageFormatter: (c) => `${c.req.method} ${c.req.path} -> ${c.res.status}`,
      contextFormatter: (c) => ({ path: c.req.path }),
    });

    await app.request("/ping");
    await logger.flush();

    expect(logs).toHaveLength(1);
    expect(logs[0].message).toBe("GET /ping -> 200");
    expect(logs[0]).toMatchObject({ path: "/ping", status: 200 });
    expect(logs[0].method).toBeUndefined();
  });

  it("should log through the execution context with an Edge logger", async () => {
    const logger = new EdgeLogtail("test", { throwExceptions: true });
    const logs: ILogtailLog[] = [];
    logger.setSync(async (batch) => {
      logs.push(...batch);
      return batch;
    });
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const executionCtx = { waitUntil: jest.fn(), passThroughOnException: jest.fn(), props: {} };

    const app = new Hono();
    app.use(logtail(logger));
    app.get("/ping", (c) => c.text("pong"));

    await app.request("/ping", undefined, undefined, executionCtx);
    await logger.flush();

    expect(executionCtx.waitUntil).toHaveBeenCalledTimes(1);
    expect(executionCtx.waitUntil.mock.calls[0][0]).toBeInstanceOf(Promise);
    expect(logs.map((log) => log.message)).toEqual(["Hono HTTP request: 200"]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("should fall back to the logger itself when there is no execution context", async () => {
    const logger = new EdgeLogtail("test", { throwExceptions: true, warnAboutMissingExecutionContext: false });
    const logs: ILogtailLog[] = [];
    logger.setSync(async (batch) => {
      logs.push(...batch);
      return batch;
    });

    const app = new Hono();
    app.use(logtail(logger));
    app.get("/ping", (c) => c.text("pong"));

    await app.request("/ping");
    await logger.flush();

    expect(logs.map((log) => log.message)).toEqual(["Hono HTTP request: 200"]);
  });

  it("should accept a function returning the logger for the request", async () => {
    const { logger, logs } = getLogger();
    const getRequestLogger = jest.fn((_c: Context) => logger);

    const app = new Hono();
    app.use(logtail(getRequestLogger));
    app.get("/ping", (c) => c.text("pong"));

    await app.request("/ping");
    await logger.flush();

    expect(getRequestLogger).toHaveBeenCalledTimes(1);
    expect(getRequestLogger.mock.calls[0][0].req.path).toBe("/ping");
    expect(logs).toHaveLength(1);
  });
});
