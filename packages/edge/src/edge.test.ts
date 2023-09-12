import { ILogtailLog, LogLevel } from "@logtail/types";

import { Edge } from "./edge";

import { Mock } from "jest-mock";
import { ExecutionContext } from "@cloudflare/workers-types";

addEventListener("fetch", event => {
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

describe("edge tests", () => {
  beforeEach(() => {
    // Mock console warnings
    console.warn = jest.fn();
  });

  it("should echo log if logtail sends 20x status code", async () => {
    const message: string = String(Math.random());
    const expectedLog = getRandomLog(message);
    const edge = new Edge("valid source token");

    edge.setSync(async logs => logs);

    const echoedLog = await edge.log(message);
    expect(echoedLog.message).toEqual(expectedLog.message);
    expect((console.warn as Mock).mock.calls).toHaveLength(1);
  });

  it("should throw error if logtail sends non 200 status code", async () => {
    const edge = new Edge("invalid source token", {
      ignoreExceptions: false,
      throwExceptions: true,
    });

    edge.setSync(async () => {
      throw new Error("Mocked error in logging");
    });

    const message: string = String(Math.random);
    await expect(edge.log(message)).rejects.toThrow();
    expect((console.warn as Mock).mock.calls).toHaveLength(1);
  });

  it("should warn and echo log even with circular reference as context", async () => {
    let circularContext: any = { foo: { value: 42 } };
    circularContext.foo.bar = circularContext;

    const message: string = String(Math.random());
    const expectedLog = getRandomLog(message);
    const edge = new Edge("valid source token");

    edge.setSync(async logs => logs);

    const echoedLog = await edge.log(message, LogLevel.Info, circularContext);
    expect(echoedLog.message).toEqual(expectedLog.message);
    expect((console.warn as Mock).mock.calls).toHaveLength(1);
  });

  it("should contain context info", async () => {
    const message: string = String(Math.random());
    const edge = new Edge("valid source token");

    edge.setSync(async logs => logs);

    const echoedLog = await edge.log(message);
    expect(typeof echoedLog.context).toBe("object");
    expect(typeof echoedLog.context.runtime).toBe("object");
    expect(typeof echoedLog.context.runtime.file).toBe("string");
    expect(typeof echoedLog.context.runtime.line).toBe("number");
    expect((console.warn as Mock).mock.calls).toHaveLength(1);
  });

  it("should warn about missing ExecutionContext only once", async () => {
    const message: string = String(Math.random());
    const edge = new Edge("valid source token");

    edge.setSync(async logs => logs);

    edge.log(message);
    edge.info(message);
    edge.warn(message);
    edge.error(message);

    expect((console.warn as Mock).mock.calls).toHaveLength(1);
    expect((console.warn as Mock).mock.calls[0][0]).toBe(
      "ExecutionContext hasn't been set via `withExecutionContext` method. Logs may not reach Better Stack unless you manually call `ctx.waitUntil(log)`.",
    );
  });

  it("should not warn about missing ExecutionContext if set", async () => {
    const message: string = String(Math.random());
    const edge = new Edge("valid source token");
    edge.setSync(async logs => logs);

    const edgeWithCtx = edge.withExecutionContext({
      waitUntil() {},
      passThroughOnException() {},
    } as ExecutionContext);

    edgeWithCtx.log(message);
    edgeWithCtx.info(message);
    edgeWithCtx.warn(message);
    edgeWithCtx.error(message);

    expect((console.warn as Mock).mock.calls).toHaveLength(0);
  });
});
