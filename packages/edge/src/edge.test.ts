import { ILogtailEdgeOptions, ILogtailLog, LogLevel } from "@logtail/types";

import { Edge } from "./edge";
import type { ExecutionContext as WaitUntilContext } from "./executionContext";

import { Mock } from "jest-mock";
import type { ExecutionContext } from "@cloudflare/workers-types";

addEventListener("fetch", (event) => {
  console.log(event);
});

/**
 * Create a log with a random string / current date
 */
function getRandomLog(message: string): Partial<ILogtailLog> {
  return {
    dt: new Date(),
    level: LogLevel.Info,
    message,
  };
}

const originalConsoleWarn = console.warn;

describe("edge tests", () => {
  beforeEach(() => {
    // Mock console warnings
    console.warn = jest.fn();
  });
  afterEach(() => {
    console.warn = originalConsoleWarn;
  });

  it("should echo log if logtail sends 20x status code", async () => {
    const message: string = String(Math.random());
    const expectedLog = getRandomLog(message);
    const edge = new Edge("valid source token", { throwExceptions: true });

    edge.setSync(async (logs) => logs);

    const echoedLog = await edge.log(message);
    expect(echoedLog.message).toEqual(expectedLog.message);
    expect((console.warn as Mock).mock.calls).toHaveLength(1);
  });

  it("should throw error if logtail sends non 200 status code", async () => {
    const edge = new Edge("invalid source token", { throwExceptions: true });

    edge.setSync(async () => {
      throw new Error("Mocked error in logging");
    });

    const message: string = String(Math.random);
    await expect(edge.log(message)).rejects.toThrow("Mocked error in logging");
    expect((console.warn as Mock).mock.calls).toHaveLength(1);
  });

  it("should warn and echo log even with circular reference as context", async () => {
    let circularContext: any = { foo: { value: 42 } };
    circularContext.foo.bar = circularContext;

    const message: string = String(Math.random());
    const expectedLog = getRandomLog(message);
    const edge = new Edge("valid source token", {
      throwExceptions: true,
      warnAboutMissingExecutionContext: false,
    });

    edge.setSync(async (logs) => logs);

    const echoedLog = await edge.log(message, LogLevel.Info, circularContext);
    expect(echoedLog.message).toEqual(expectedLog.message);
    expect((console.warn as Mock).mock.calls).toHaveLength(1);
    expect((console.warn as Mock).mock.calls[0][0]).toBe(
      "[Logtail] Found a circular reference when serializing logs. Please do not use circular references in your logs.",
    );
  });

  it("should contain context info", async () => {
    const message: string = String(Math.random());
    const edge = new Edge("valid source token", { throwExceptions: true });

    edge.setSync(async (logs) => logs);

    const echoedLog = await edge.log(message);
    expect(typeof echoedLog.context).toBe("object");
    expect(typeof echoedLog.context.runtime).toBe("object");
    expect(typeof echoedLog.context.runtime.file).toBe("string");
    expect(typeof echoedLog.context.runtime.line).toBe("number");
    expect((console.warn as Mock).mock.calls).toHaveLength(1);
  });

  it("should warn about missing ExecutionContext only once", async () => {
    const message: string = String(Math.random());
    const edge = new Edge("valid source token", { throwExceptions: true });

    edge.setSync(async (logs) => logs);

    edge.log(message);
    edge.info(message);
    edge.warn(message);
    edge.error(message);

    expect((console.warn as Mock).mock.calls).toHaveLength(1);
    expect((console.warn as Mock).mock.calls[0][0]).toBe(
      "ExecutionContext hasn't been passed to the `log` method, which means syncing logs cannot be guaranteed. " +
        "To ensure your logs will reach Better Stack, use `logger.withExecutionContext(ctx)` to log in your handler function. " +
        "See https://betterstack.com/docs/logs/js-edge-execution-context/ for details.",
    );
  });

  it("should skip stack context capture when captureStackContext is false", async () => {
    const message: string = String(Math.random());
    const edge = new Edge("valid source token", {
      throwExceptions: true,
      warnAboutMissingExecutionContext: false,
      captureStackContext: false,
    });

    edge.setSync(async (logs) => logs);

    const echoedLog = await edge.log(message);
    expect(echoedLog.context).toBeUndefined();
  });

  it("should include stack context by default", async () => {
    const message: string = String(Math.random());
    const edge = new Edge("valid source token", {
      throwExceptions: true,
      warnAboutMissingExecutionContext: false,
    });

    edge.setSync(async (logs) => logs);

    const echoedLog = await edge.log(message);
    expect(typeof echoedLog.context).toBe("object");
    expect(typeof echoedLog.context.runtime).toBe("object");
    expect(typeof echoedLog.context.runtime.file).toBe("string");
    expect(typeof echoedLog.context.runtime.line).toBe("number");
  });

  it("should include stack context when captureStackContext is explicitly true", async () => {
    const message: string = String(Math.random());
    const edge = new Edge("valid source token", {
      throwExceptions: true,
      warnAboutMissingExecutionContext: false,
      captureStackContext: true,
    });

    edge.setSync(async (logs) => logs);

    const echoedLog = await edge.log(message);
    expect(typeof echoedLog.context).toBe("object");
    expect(typeof echoedLog.context.runtime).toBe("object");
    expect(typeof echoedLog.context.runtime.file).toBe("string");
    expect(typeof echoedLog.context.runtime.line).toBe("number");
  });

  it("should not warn about missing ExecutionContext if set", async () => {
    const message: string = String(Math.random());
    const edge = new Edge("valid source token", { throwExceptions: true });
    edge.setSync(async (logs) => logs);

    const edgeWithCtx = edge.withExecutionContext({
      waitUntil() {},
      passThroughOnException() {},
    } as unknown as ExecutionContext);

    edgeWithCtx.log(message);
    edgeWithCtx.info(message);
    edgeWithCtx.warn(message);
    edgeWithCtx.error(message);

    expect((console.warn as Mock).mock.calls).toHaveLength(0);
  });
});

describe("withExecutionContext flushing", () => {
  function getEdge(options: Partial<ILogtailEdgeOptions> = {}, syncMilliseconds = 0) {
    const edge = new Edge("valid source token", { throwExceptions: true, ...options });
    const batches: ILogtailLog[][] = [];
    edge.setSync(async (logs) => {
      await new Promise((resolve) => setTimeout(resolve, syncMilliseconds));
      batches.push(logs);
      return logs;
    });
    const waited: Promise<unknown>[] = [];
    const ctx = {
      waitUntil(promise: Promise<unknown>) {
        waited.push(promise);
      },
    };
    return { edge, batches, waited, ctx };
  }

  // Starts `count` requests at once, each logging one line in a task of its own
  function logInParallelRequests(edge: Edge, ctx: WaitUntilContext, count: number) {
    return Promise.all(
      [...Array(count).keys()].map(
        (request) =>
          new Promise<void>((resolve) =>
            setTimeout(() => {
              edge.withExecutionContext(ctx).info(`request ${request}`);
              resolve();
            }),
          ),
      ),
    );
  }

  it("should send a request's logs right away instead of waiting for the batch interval", async () => {
    const { edge, batches, waited, ctx } = getEdge();
    const startedAt = Date.now();

    const logger = edge.withExecutionContext(ctx);
    logger.info("first");
    logger.warn("second");
    await Promise.all(waited);

    expect(Date.now() - startedAt).toBeLessThan(500);
    expect(batches.map((batch) => batch.map((log) => log.message))).toEqual([["first", "second"]]);
  });

  it("should send logs made after an await in a flush of their own", async () => {
    const { edge, batches, waited, ctx } = getEdge();

    const logger = edge.withExecutionContext(ctx);
    logger.info("first");
    await new Promise((resolve) => setTimeout(resolve, 10));
    logger.info("second");
    await Promise.all(waited);

    expect(batches.map((batch) => batch.map((log) => log.message))).toEqual([["first"], ["second"]]);
  });

  it("should send a log passing through an async middleware in its request's own flush", async () => {
    const { edge, batches, waited, ctx } = getEdge();
    edge.use(async (log) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return log;
    });
    const startedAt = Date.now();

    edge.withExecutionContext(ctx).info("first");
    await Promise.all(waited);

    expect(Date.now() - startedAt).toBeLessThan(500);
    expect(batches.map((batch) => batch.map((log) => log.message))).toEqual([["first"]]);
  });

  it("should not hold a request's send back until other requests' sends complete", async () => {
    const { edge, batches, waited, ctx } = getEdge({}, 50);
    const startedAt = Date.now();

    await logInParallelRequests(edge, ctx, 20);
    await Promise.all(waited);

    expect(batches).toHaveLength(20);
    // 20 sends of 50 ms each, all at once; 5 at a time would take 200 ms
    expect(Date.now() - startedAt).toBeLessThan(150);
  });

  it("should limit concurrent sends to an explicit syncMax option", async () => {
    const { edge, batches, waited, ctx } = getEdge({ syncMax: 1 }, 50);
    const startedAt = Date.now();

    await logInParallelRequests(edge, ctx, 3);
    await Promise.all(waited);

    expect(batches).toHaveLength(3);
    // 3 sends of 50 ms each, one after another
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(140);
  });
});
