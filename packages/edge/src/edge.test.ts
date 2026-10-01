import { ILogtailLog, LogLevel } from "@logtail/types";

import { Edge } from "./edge";

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

  describe("request timeout", () => {
    let fetchMock: jest.SpyInstance;

    beforeEach(() => {
      jest.useFakeTimers();
      // The edge-runtime test environment has no CompressionStream, and the request body doesn't matter here
      (globalThis as any).CompressionStream = jest.fn(() => new TransformStream());
      // An endpoint that never answers: the request only ends when it gets aborted, with the abort reason
      fetchMock = jest.spyOn(globalThis, "fetch").mockImplementation(
        (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            const signal = init?.signal;
            signal?.addEventListener("abort", () => reject(signal.reason));
          }),
      );
    });
    afterEach(() => {
      fetchMock.mockRestore();
      delete (globalThis as any).CompressionStream;
      jest.useRealTimers();
    });

    it("should abort a request after 30 seconds by default and retry it like any other failed request", async () => {
      const edge = new Edge("valid source token", {
        retryCount: 1,
        // A single sync slot: the retry can only be sent once the aborted request has released it
        syncMax: 1,
        throwExceptions: true,
        warnAboutMissingExecutionContext: false,
      });

      let error: unknown;
      edge.log("never answered").catch((e) => (error = e));
      // Two attempts, each sent after the 1 s batch interval and aborted after 30 s
      await jest.advanceTimersByTimeAsync(62000);

      expect(error).toEqual(new Error("Request timeout after 30000ms"));
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(edge.dropped).toBe(1);
    });

    it("should not abort requests when timeout is 0", async () => {
      const edge = new Edge("valid source token", {
        timeout: 0,
        throwExceptions: true,
        warnAboutMissingExecutionContext: false,
      } as any);

      let settled = false;
      edge.log("never answered").then(
        () => (settled = true),
        () => (settled = true),
      );
      await jest.advanceTimersByTimeAsync(60 * 60 * 1000);

      expect(settled).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("should not leave the timeout behind after a successful request", async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 202 }));
      const edge = new Edge("valid source token", {
        throwExceptions: true,
        warnAboutMissingExecutionContext: false,
      });

      const logged = edge.log("answered");
      await jest.advanceTimersByTimeAsync(1000);
      await logged;

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    });
  });
});
