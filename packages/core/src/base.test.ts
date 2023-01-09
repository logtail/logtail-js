import Base from "./base";
import { ILogtailLog, LogLevel } from "@logtail/types";

describe("base class tests", () => {
  it("should initialize with source token", () => {
    const sourceToken = "testing";
    const base = new Base(sourceToken);

    expect((base as any)._sourceToken).toEqual(sourceToken);
  });

  it("should throw if a `sync` method is missing", async () => {
    const base = new Base("testing");

    // Expect logging to throw an error, since we're missing a `sync` func
    await expect(base.log("Test")).rejects.toThrowError(/sync/);
  });

  it("should add an implicit `dt` timestamp", async () => {
    // Fixtures
    const message = "Test";
    const base = new Base("testing");

    // Add a mock sync method
    base.setSync(async logs => logs);

    // Pass the log through the `.log()` function and get the result
    const result = await base.log(message);

    // Expect the message to be same
    expect(result.message).toEqual(message);

    // ... but a new `date` should be added
    expect(result.dt).not.toBeUndefined();
  });

  it("should default log count to zero", () => {
    const base = new Base("testing");

    expect(base.logged).toEqual(0);
  });

  it("should default synced count to zero", () => {
    const base = new Base("testing");

    expect(base.synced).toEqual(0);
  });

  it("should increment log count on `.log()`", async () => {
    const base = new Base("testing");

    // Add a mock sync method
    base.setSync(async log => log);

    void (await base.log("Test"));

    // Logged count should now be 1
    expect(base.logged).toEqual(1);
  });

  it("should sync after 500 ms", async () => {
    const base = new Base("testing");

    // Create a sync function that resolves after 500ms
    base.setSync(async log => {
      return new Promise<ILogtailLog[]>(resolve => {
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

  it("should add a pipeline function", async () => {
    // Fixtures
    const firstMessage = "First message";
    const base = new Base("testing");

    // Add a mock sync method
    base.setSync(async log => log);

    // Message to replacement with
    const newMessage = "Second message";

    // Add a custom pipeline that replaces `message`
    base.use(async log => {
      return {
        ...log,
        message: newMessage
      };
    });

    // Get the resulting log
    const result = await base.log(firstMessage);

    // The resulting message should equal the new message
    expect(result.message).toEqual(newMessage);
  });

  it("should remove a pipeline function", async () => {
    const base = new Base("testing");

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
    const base = new Base("testing");

    // Add a mock sync method
    base.setSync(async log => log);

    // Log
    const log = await base.log(message);

    // Should log at 'info' level
    expect(log.level).toEqual(LogLevel.Info);
  });

  it("should handle 'debug' logging", async () => {
    // Fixtures
    const message = "Test";
    const base = new Base("testing");

    // Add a mock sync method
    base.setSync(async log => log);

    // Log
    const log = await base.debug(message);

    // Should log at 'debug' level
    expect(log.level).toEqual(LogLevel.Debug);
  });

  it("should handle 'info' logging", async () => {
    // Fixtures
    const message = "Test";
    const base = new Base("testing");

    // Add a mock sync method
    base.setSync(async log => log);

    // Log
    const log = await base.info(message);

    // Should log at 'info' level
    expect(log.level).toEqual(LogLevel.Info);
  });

  it("should handle 'warn' logging", async () => {
    // Fixtures
    const message = "Test";
    const base = new Base("testing");

    // Add a mock sync method
    base.setSync(async log => log);

    // Log
    const log = await base.warn(message);

    // Should log at 'info' level
    expect(log.level).toEqual(LogLevel.Warn);
  });

  it("should handle 'error' logging", async () => {
    // Fixtures
    const message = "Test";
    const base = new Base("testing");

    // Add a mock sync method
    base.setSync(async log => log);

    // Log
    const log = await base.error(message);

    // Should log at 'info' level
    expect(log.level).toEqual(LogLevel.Error);
  });

  it("should handle logging an `Error` object", async () => {
    // Fixtures
    const message = "This is the error";
    const e = new Error(message);
    const base = new Base("testing");

    // Add a mock sync method
    base.setSync(async log => log);

    // Log
    const log = await base.error(e);

    // The error message should match
    expect(log.message).toBe(message);

    // Context should contain a stack trace
    expect((log as any).stack).toBe(e.stack);
  });

  it("should not ignore exceptions if `ignoreExceptions` opt == false", async () => {
    // Fixtures
    const message = "Testing exceptions";
    const e = new Error("Should NOT be ignored!");
    const base = new Base("testing", { ignoreExceptions: false });

    // Add a mock sync method which throws an error
    base.setSync(async () => {
      throw e;
    });

    expect(base.info(message)).rejects.toEqual(e);
  });

  it("should ignore exceptions by default", async () => {
    // Fixtures
    const message = "Testing exceptions";
    const base = new Base("testing", {
      ignoreExceptions: true
    });

    // Add a mock sync method which throws an error
    base.setSync(async () => {
      throw new Error("Should be ignored!");
    });

    // Log - shouldn't throw!
    const log = await base.info(message);

    // Should return the log, even though there was an error
    expect(log.message).toBe(message);
  });
});
