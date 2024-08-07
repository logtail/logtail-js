import Base from "./base";
import { ILogtailLog, LogLevel } from "@logtail/types";

describe("base class tests", () => {
  it("should initialize with source token", () => {
    const sourceToken = "testing";
    const base = new Base(sourceToken, { throwExceptions: true });

    expect((base as any)._sourceToken).toEqual(sourceToken);
  });

  it("should throw if a `sync` method is missing", async () => {
    const base = new Base("testing", { throwExceptions: true });

    // Expect logging to throw an error, since we're missing a `sync` func
    await expect(base.log("Test")).rejects.toThrow(/sync/);
  });

  it("should add an implicit `dt` timestamp", async () => {
    // Fixtures
    const message = "Test";
    const base = new Base("testing", { throwExceptions: true });

    // Add a mock sync method
    base.setSync(async (logs) => logs);

    // Pass the log through the `.log()` function and get the result
    const result = await base.log(message);

    // Expect the message to be same
    expect(result.message).toEqual(message);

    // ... but a new `date` should be added
    expect(result.dt).not.toBeUndefined();
  });

  it("should default log count to zero", () => {
    const base = new Base("testing", { throwExceptions: true });

    expect(base.logged).toEqual(0);
  });

  it("should default synced count to zero", () => {
    const base = new Base("testing", { throwExceptions: true });

    expect(base.synced).toEqual(0);
  });

  it("should default dropped count to zero", () => {
    const base = new Base("testing", { throwExceptions: true });

    expect(base.dropped).toEqual(0);
  });

  it("should increment log count on `.log()`", async () => {
    const base = new Base("testing", { throwExceptions: true });

    // Add a mock sync method
    base.setSync(async (log) => log);

    void (await base.log("Test"));

    // Logged count should now be 1
    expect(base.logged).toEqual(1);
  });

  it("should sync after 500 ms", async () => {
    const base = new Base("testing", { throwExceptions: true });

    // Create a sync function that resolves after 500ms
    base.setSync(async (log) => {
      return new Promise<ILogtailLog[]>((resolve) => {
        setTimeout(() => {
          resolve(log);
        }, 500);
      });
    });

    // Fire the log event, and store the pending promise
    const pending = base.log("Test");

    // The log count should be 1
    expect(base.logged).toEqual(1);

    // ... but synced should still be zero
    expect(base.synced).toEqual(0);

    // Await the pending sync
    void (await pending);

    // After 500ms, synced should be now be 1
    expect(base.synced).toEqual(1);
  });

  it("should sync after calling flush", async () => {
    // New Base with very long batch interval and size
    const base = new Base("testing", {
      throwExceptions: true,
      batchInterval: 10000,
      batchSize: 5,
    });

    // Create a sync function that resolves after 50ms
    base.setSync(async (log) => {
      return new Promise<ILogtailLog[]>((resolve) => {
        setTimeout(() => {
          resolve(log);
        }, 50);
      });
    });

    // Fire the log event, and store the pending promise
    const pending = base.log("Test");

    // The log count should be 1
    expect(base.logged).toEqual(1);

    // ... but synced should still be zero
    expect(base.synced).toEqual(0);

    // Trigger flush
    await base.flush();

    // After flush, synced should be now be 1
    expect(base.synced).toEqual(1);
  });

  it("should add a pipeline function", async () => {
    // Fixtures
    const firstMessage = "First message";
    const base = new Base("testing", { throwExceptions: true });

    // Add a mock sync method
    base.setSync(async (log) => log);

    // Message to replacement with
    const newMessage = "Second message";

    // Add a custom pipeline that replaces `message`
    base.use(async (log) => {
      return {
        ...log,
        message: newMessage,
      };
    });

    // Get the resulting log
    const result = await base.log(firstMessage);

    // The resulting message should equal the new message
    expect(result.message).toEqual(newMessage);
  });

  it("should remove a pipeline function", async () => {
    const base = new Base("testing", { throwExceptions: true });

    // Create a pipeline function
    const customPipeline = async (log: ILogtailLog) => log;

    // Add the pipeline
    base.use(customPipeline);

    // Confirm that it exists in the `_pipeline` array
    expect((base as any)._middleware).toContain(customPipeline);

    // Remove the pipeline
    base.remove(customPipeline);

    // Confirm that it has disappeared from the array
    expect((base as any)._middleware).not.toContain(customPipeline);
  });

  it("should default to 'info' level logging", async () => {
    // Fixtures
    const message = "Test";
    const base = new Base("testing", { throwExceptions: true });

    // Add a mock sync method
    base.setSync(async (log) => log);

    // Log
    const log = await base.log(message);

    // Should log at 'info' level
    expect(log.level).toEqual(LogLevel.Info);
  });

  it("should handle 'debug' logging", async () => {
    // Fixtures
    const message = "Test";
    const base = new Base("testing", { throwExceptions: true });

    // Add a mock sync method
    base.setSync(async (log) => log);

    // Log
    const log = await base.debug(message);

    // Should log at 'debug' level
    expect(log.level).toEqual(LogLevel.Debug);
  });

  it("should handle 'info' logging", async () => {
    // Fixtures
    const message = "Test";
    const base = new Base("testing", { throwExceptions: true });

    // Add a mock sync method
    base.setSync(async (log) => log);

    // Log
    const log = await base.info(message);

    // Should log at 'info' level
    expect(log.level).toEqual(LogLevel.Info);
  });

  it("should handle 'warn' logging", async () => {
    // Fixtures
    const message = "Test";
    const base = new Base("testing", { throwExceptions: true });

    // Add a mock sync method
    base.setSync(async (log) => log);

    // Log
    const log = await base.warn(message);

    // Should log at 'info' level
    expect(log.level).toEqual(LogLevel.Warn);
  });

  it("should handle 'error' logging", async () => {
    // Fixtures
    const message = "Test";
    const base = new Base("testing", { throwExceptions: true });

    // Add a mock sync method
    base.setSync(async (log) => log);

    // Log
    const log = await base.error(message);

    // Should log at 'info' level
    expect(log.level).toEqual(LogLevel.Error);
  });

  it("should handle logging an `Error` object", async () => {
    // Fixtures
    const message = "This is the error";
    const e = new Error(message);
    const base = new Base("testing", { throwExceptions: true });

    // Add a mock sync method
    base.setSync(async (log) => log);

    // Log
    const log = await base.error(e);

    // The error message should match
    expect(log.message).toBe(message);

    // Context should contain a stack trace
    expect(log.stack).toBe(e.stack);
  });

  it("should not ignore exceptions if `ignoreExceptions` opt == false and `throwExceptions` opt == true", async () => {
    // Fixtures
    const message = "Testing exceptions";
    const e = new Error("Should NOT be ignored!");
    const base = new Base("testing", { throwExceptions: true });

    // Add a mock sync method which throws an error
    base.setSync(async () => {
      throw e;
    });

    expect(base.info(message)).rejects.toEqual(e);
  });

  it("should ignore exceptions by default", async () => {
    // Fixtures
    const message = "Testing exceptions";
    const base = new Base("testing", { ignoreExceptions: true });

    // Add a mock sync method which throws an error
    base.setSync(async () => {
      throw new Error("Should be ignored!");
    });

    // Log - shouldn't throw!
    const log = await base.info(message);

    // Should return the log, even though there was an error
    expect(log.message).toBe(message);
  });

  it("should sync all logs in single call", async () => {
    // Fixtures
    const message = "Testing logging";
    const base = new Base("testing", { throwExceptions: true });

    // Add a mock sync method which counts sync calls and sent logs
    let syncCount = 0;
    let logsCount = 0;
    base.setSync(async (logs) => {
      syncCount++;
      logsCount = logs.length;
      return logs;
    });

    await Promise.all([base.debug(message), base.info(message), base.warn(message), base.error(message)]);

    // Should sync all logs in single call
    expect(syncCount).toBe(1);
    expect(logsCount).toBe(4);
    expect(base.synced).toBe(4);
    expect(base.logged).toBe(4);
  });

  it("should not send any logs to Better Stack when sendLogsToBetterStack=false", async () => {
    // Fixtures
    const message = "Testing logging";
    const base = new Base("testing", {
      throwExceptions: true,
      sendLogsToBetterStack: false,
    });

    // Add a mock sync method which counts sync calls
    let syncCount = 0;
    base.setSync(async (log) => {
      syncCount++;
      return log;
    });

    await base.debug(message);
    await base.info(message);
    await base.warn(message);
    await base.error(message);
    await base.log(message, "fatal");
    await base.log(message, "http");
    await base.log(message, "verbose");
    await base.log(message, "silly");
    await base.log(message, "trace");

    // Should sync no logs
    expect(syncCount).toBe(0);
    expect(base.synced).toBe(0);
    expect(base.logged).toBe(9);
  });

  it("should send all logs to console output when sendLogsToConsoleOutput=true", async () => {
    // Fixtures
    const message = "Testing logging";
    const base = new Base("testing", {
      throwExceptions: true,
      sendLogsToConsoleOutput: true,
      batchInterval: 10,
    });

    // Add a mock sync method
    base.setSync(async (log) => log);

    // Mock console methods
    const originalConsole = console;
    const consoleOutputs: any = [];
    console = {
      ...console,
      debug: (...args: any) => consoleOutputs.push(["debug", ...args]),
      info: (...args: any) => consoleOutputs.push(["info", ...args]),
      warn: (...args: any) => consoleOutputs.push(["warn", ...args]),
      error: (...args: any) => consoleOutputs.push(["error", ...args]),
      log: (...args: any) => consoleOutputs.push(["log", ...args]),
    };

    await base.debug(message);
    await base.info(message);
    await base.warn(message);
    await base.error(message);
    await base.log(message, "fatal");
    await base.log(message, "http");
    await base.log(message, "verbose");
    await base.log(message, "silly");
    await base.log(message, "trace");

    // Should forward all logs to console output
    expect(consoleOutputs).toEqual([
      ["debug", "Testing logging", {}],
      ["info", "Testing logging", {}],
      ["warn", "Testing logging", {}],
      ["error", "Testing logging", {}],
      ["log", "[FATAL]", "Testing logging", {}],
      ["log", "[HTTP]", "Testing logging", {}],
      ["log", "[VERBOSE]", "Testing logging", {}],
      ["log", "[SILLY]", "Testing logging", {}],
      ["log", "[TRACE]", "Testing logging", {}],
    ]);
    expect(base.synced).toBe(9);
    expect(base.logged).toBe(9);

    console = originalConsole;
  });

  it("should limit sent requests", async () => {
    // Fixtures
    const message = "Testing logging";
    const base = new Base("testing", { throwExceptions: true });

    // Add a mock sync method which resolves after a timeout
    base.setSync(async (logs) => {
      return new Promise<ILogtailLog[]>((resolve) => {
        setTimeout(() => resolve(logs), 100);
      });
    });

    // Mock console.error()
    const mockedConsoleError = jest.fn();
    const originalConsoleError = console.error;
    console.error = mockedConsoleError;

    const logs = [];
    for (let i = 0; i < 1000000; i++) {
      logs.push(base.info(message));
    }

    await Promise.all(logs);

    console.error = originalConsoleError;

    // Should sync only 10000 logs
    expect(base.synced).toBe(10000);
    expect(base.logged).toBe(10000);

    expect(mockedConsoleError).toHaveBeenCalledWith(
      "Logging was called more than 10000 times during last 5000ms. Ignoring.",
    );
    expect(mockedConsoleError).toHaveBeenCalledTimes(1);
  });

  it("should not limit sent requests if not exceeding burst protection limits", async () => {
    // Fixtures
    const message = "Testing logging";
    const base = new Base("testing", {
      throwExceptions: true,
      burstProtectionMilliseconds: 100,
      burstProtectionMax: 100,
    });

    // Add a mock sync method
    base.setSync(async (logs) => logs);

    // Mock console.error()
    const mockedConsoleError = jest.fn();
    const originalConsoleError = console.error;
    console.error = mockedConsoleError;

    const logs = [];
    for (let i = 0; i < 500; i++) {
      logs.push(base.info(message));
      // Wait for 1ms after every log
      await new Promise((resolve) => setTimeout(resolve, 1));
    }

    await Promise.all(logs);

    console.error = originalConsoleError;

    // Should sync all logs
    expect(base.synced).toBe(500);
    expect(base.logged).toBe(500);

    expect(mockedConsoleError).toHaveBeenCalledTimes(0);
  });

  it("should limit sent requests if exceeding burst protection limits", async () => {
    // Fixtures
    const message = "Testing logging";
    const base = new Base("testing", {
      throwExceptions: true,
      burstProtectionMilliseconds: 100,
      burstProtectionMax: 50,
    });

    // Add a mock sync method
    base.setSync(async (logs) => logs);

    // Mock console.error()
    const mockedConsoleError = jest.fn();
    const originalConsoleError = console.error;
    console.error = mockedConsoleError;

    const logs = [];
    for (let i = 0; i < 500; i++) {
      // Send logs with 1ms delay between them
      logs.push(
        new Promise((resolve) => {
          setTimeout(() => base.info(message).then(resolve), i);
        }),
      );
    }

    await Promise.all(logs);

    console.error = originalConsoleError;

    // Should sync only approximately half the logs
    expect(base.synced).toBeGreaterThan(240);
    expect(base.synced).toBeLessThan(260);
    expect(base.logged).toBeGreaterThan(240);
    expect(base.logged).toBeLessThan(260);

    expect(mockedConsoleError).toHaveBeenCalledWith(
      "Logging was called more than 50 times during last 100ms. Ignoring.",
    );
    expect(mockedConsoleError).toHaveBeenCalledTimes(5);
  });

  it("should not limit sent requests if burst protection disabled", async () => {
    // Fixtures
    const message = "Testing logging";
    const base = new Base("testing", {
      throwExceptions: true,
      burstProtectionMax: 0,
    });

    // Add a mock sync method
    base.setSync(async (logs) => logs);

    // Mock console.error()
    const mockedConsoleError = jest.fn();
    const originalConsoleError = console.error;
    console.error = mockedConsoleError;

    const logs = [];
    for (let i = 0; i < 100000; i++) {
      logs.push(base.info(message));
    }

    await Promise.all(logs);

    console.error = originalConsoleError;

    // Should sync all logs
    expect(base.synced).toBe(100000);
    expect(base.logged).toBe(100000);

    expect(mockedConsoleError).toHaveBeenCalledTimes(0);
  });
});
