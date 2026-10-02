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

describe("request batches", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  function getEdge(options: Partial<ILogtailEdgeOptions> = {}, syncMilliseconds = 0) {
    const edge = new Edge("valid source token", { throwExceptions: true, batchInterval: 10, ...options });
    const batches: ILogtailLog[][] = [];
    edge.setSync(async (logs) => {
      await new Promise((resolve) => setTimeout(resolve, syncMilliseconds));
      batches.push(logs);
      return logs;
    });
    const waited: Promise<unknown>[] = [];
    const ctx = requestContext(waited);
    return { edge, batches, waited, ctx };
  }

  // The execution context of a new request, recording what the request is kept alive for in `waited`
  function requestContext(waited: Promise<unknown>[]): WaitUntilContext {
    return {
      waitUntil(promise: Promise<unknown>) {
        waited.push(promise);
      },
    };
  }

  // Starts `count` requests at once, each logging one line in a task of its own
  function logInParallelRequests(edge: Edge, waited: Promise<unknown>[], count: number) {
    return Promise.all(
      [...Array(count).keys()].map(
        (request) =>
          new Promise<void>((resolve) =>
            setTimeout(() => {
              edge.withExecutionContext(requestContext(waited)).info(`request ${request}`);
              resolve();
            }),
          ),
      ),
    );
  }

  it("should send a request's logs right away, and the logs logged during that send in one send after it", async () => {
    const { edge, batches, waited, ctx } = getEdge({ batchInterval: 10000 }, 50);
    const startedAt = Date.now();

    const logger = edge.withExecutionContext(ctx);
    logger.info("first");
    logger.info("same tick");
    await new Promise((resolve) => setTimeout(resolve, 10));
    logger.info("during the send");
    await new Promise((resolve) => setTimeout(resolve, 10));
    logger.info("also during the send");
    await Promise.all(waited);

    // Not held back for the batch interval
    expect(Date.now() - startedAt).toBeLessThan(1000);
    expect(messages(batches)).toEqual([
      ["first", "same tick"],
      ["during the send", "also during the send"],
    ]);
  });

  it("should send a log passing through an async middleware in its request's batch", async () => {
    const { edge, batches, waited, ctx } = getEdge();
    edge.use(async (log) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return log;
    });

    edge.withExecutionContext(ctx).info("first");
    await Promise.all(waited);

    expect(messages(batches)).toEqual([["first"]]);
  });

  it("should send and retry each request's logs in its own batch, on its own timer", async () => {
    const { edge, waited, ctx } = getEdge({ retryCount: 1 });
    const attempts: string[][] = [];
    edge.setSync(async (logs) => {
      attempts.push(logs.map((log) => log.message));
      if (logs.some((log) => log.message === "failing")) {
        throw new Error("outage");
      }
      return logs;
    });

    const otherWaited: Promise<unknown>[] = [];
    const otherCtx = { waitUntil: (promise: Promise<unknown>) => otherWaited.push(promise.catch(() => {})) };
    edge
      .withExecutionContext(otherCtx)
      .info("failing")
      .catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 5));
    edge.withExecutionContext(ctx).info("other");

    // Each request is kept alive until its own log is sent, or dropped after its retry
    expect(await settledWithin(Promise.all(waited), 100)).toEqual(true);
    expect(await settledWithin(Promise.all(otherWaited), 100)).toEqual(true);
    expect(attempts.sort()).toEqual([["failing"], ["failing"], ["other"]]);
  });

  it("should leave no timer of a request behind once its waitUntil settles", async () => {
    jest.useFakeTimers();
    const { edge, waited, ctx } = getEdge();
    let failures = 1;
    edge.setSync(async (logs) => {
      if (failures-- > 0) {
        throw new Error("outage");
      }
      return logs;
    });

    const logger = edge.withExecutionContext(ctx);
    logger.info("first");
    await jest.advanceTimersByTimeAsync(5);
    logger.info("second");
    let settled = false;
    Promise.all(waited).then(() => (settled = true));
    await jest.advanceTimersByTimeAsync(100);

    expect(settled).toEqual(true);
    expect(jest.getTimerCount()).toEqual(0);
  });

  it("should wait for a request's send with its logger's flush(), and send logs without a request with flush()", async () => {
    const { edge, batches, ctx } = getEdge({ batchInterval: 10000, warnAboutMissingExecutionContext: false }, 50);

    edge.info("without execution context");
    const logger = edge.withExecutionContext(ctx);
    logger.info("with execution context");
    await new Promise((resolve) => setTimeout(resolve, 10));
    await logger.flush();

    expect(messages(batches)).toEqual([["with execution context"]]);
    await edge.flush();
    expect(messages(batches)).toEqual([["with execution context"], ["without execution context"]]);
  });

  it("should not hold a request's send back until other requests' sends complete", async () => {
    const { edge, batches, waited } = getEdge({}, 50);
    const startedAt = Date.now();

    await logInParallelRequests(edge, waited, 20);
    await Promise.all(waited);

    expect(batches).toHaveLength(20);
    // 20 sends of 50 ms each, all at once; 5 at a time would take 200 ms
    expect(Date.now() - startedAt).toBeLessThan(150);
  });

  it("should limit concurrent sends to an explicit syncMax option", async () => {
    const { edge, batches, waited } = getEdge({ syncMax: 1 }, 50);
    const startedAt = Date.now();

    await logInParallelRequests(edge, waited, 3);
    await Promise.all(waited);

    expect(batches).toHaveLength(3);
    // 3 sends of 50 ms each, one after another
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(140);
  });

  it("should not hold a request back on a send another request has in flight", async () => {
    const { edge, batches, waited, ctx } = getEdge({ warnAboutMissingExecutionContext: false });
    let sends = 0;
    edge.setSync(async (logs) => {
      // The first send never completes, like one left behind by a request that has ended
      if (++sends === 1) {
        await new Promise(() => {});
      }
      batches.push(logs);
      return logs;
    });

    edge.info("without execution context");
    edge.flush();
    edge.withExecutionContext(ctx).info("with execution context");

    expect(await settledWithin(Promise.all(waited), 100)).toEqual(true);
    expect(messages(batches)).toEqual([["with execution context"]]);
  });

  it("should not hold a request back on another request's log stuck in middleware", async () => {
    const { edge, batches, waited, ctx } = getEdge();
    edge.use(async (log) => (log.message === "stuck" ? new Promise<ILogtailLog>(() => {}) : log));

    edge.withExecutionContext({ waitUntil() {} }).info("stuck");
    edge.withExecutionContext(ctx).info("other");

    expect(await settledWithin(Promise.all(waited), 100)).toEqual(true);
    expect(messages(batches)).toEqual([["other"]]);
  });
});

function messages(batches: ILogtailLog[][]) {
  return batches.map((batch) => batch.map((log) => log.message));
}

function settledWithin(promise: Promise<unknown>, milliseconds: number): Promise<boolean> {
  return Promise.race([
    promise.then(() => true),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), milliseconds)),
  ]);
}
