import bunyan, { LogLevelString } from "bunyan";
import { Logtail } from "@logtail/node";
import { LogLevel } from "@logtail/types";

import { LogtailStream } from "./bunyan";

// Numeric log level test type
type LevelTest = [number, LogLevel, LogLevelString];

// Sample log message
const message = "Something to do with something";

/**
 * Create a Bunyan logger instance
 *
 * @param logtail - `Logtail` instance
 */
function createLogger(logtail: Logtail): bunyan {
  return bunyan.createLogger({
    name: "Test logger",
    level: "debug", // <-- default to 'debug' and above
    streams: [
      {
        stream: new LogtailStream(logtail),
      },
    ],
  });
}

/**
 * Test a Bunyan log level vs. a Logtail `LogLevel`
 *
 * @param level LogLevelString - Bunyan log level (string)
 * @param logLevel LogLevel - Logtail log level
 */
async function testLevel(level: LogLevelString, logLevel: LogLevel) {
  // Logtail fixtures
  const logtail = new Logtail("test", {
    throwExceptions: true,
    batchInterval: 1,
  });
  logtail.setSync(async logs => {
    // Should be exactly one log
    expect(logs.length).toBe(1);

    // Message should match
    expect(logs[0].message).toBe(message);

    // Log level should be 'info'
    expect(logs[0].level).toBe(logLevel);

    return logs;
  });

  // Create Bunyan logger
  const logger = createLogger(logtail);

  // Log out to Bunyan
  logger[level](message);
}

describe("Bunyan tests", () => {
  it("should log at the 'debug' level", async () => {
    return testLevel("debug", LogLevel.Debug);
  });

  it("should log at the 'info' level", async () => {
    return testLevel("info", LogLevel.Info);
  });

  it("should log at the 'warn' level", async () => {
    return testLevel("warn", LogLevel.Warn);
  });

  it("should log at the 'error' level", async () => {
    return testLevel("error", LogLevel.Error);
  });

  it("should log at the 'fatal' level", async () => {
    return testLevel("fatal", LogLevel.Fatal);
  });

  it("should log using number levels", async () => {
    // Fixtures
    const levels: LevelTest[] = [
      [20, LogLevel.Debug, "debug"],
      [30, LogLevel.Info, "info"],
      [40, LogLevel.Warn, "warn"],
      [50, LogLevel.Error, "error"],
      [60, LogLevel.Fatal, "fatal"],
    ];

    const logtail = new Logtail("test", {
      throwExceptions: true,
      batchInterval: 1000,
      batchSize: levels.length,
    });

    logtail.setSync(async logs => {
      expect(logs.length).toBe(levels.length);

      return logs;
    });

    // Create Bunyan logger
    const logger = createLogger(logtail);

    // Cycle through levels, and log
    levels.forEach(level => logger[level[2]](message));
  });

  it("should include arbitrary extra data fields", async () => {
    const logtail = new Logtail("test", { throwExceptions: true });
    logtail.setSync(async logs => {
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toEqual("i am the message");
      expect(logs[0].foo).toEqual("bar");
      expect(logs[0].some).toEqual({ nested: "stuff" });

      return logs;
    });
    const logger = createLogger(logtail);
    logger.info({ foo: "bar", some: { nested: "stuff" } }, "i am the message");
  });

  it("should include correct context fields", async () => {
    const logtail = new Logtail("test", { throwExceptions: true });
    logtail.setSync(async logs => {
      const context = logs[0].context;
      expect(context.runtime.file).toMatch("bunyan.test.ts");

      return logs;
    });
    const logger = createLogger(logtail);
    logger.info("message with context");
  });
});
