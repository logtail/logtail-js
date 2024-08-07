import winston, { LogEntry } from "winston";
import { Logtail } from "@logtail/node";
import { LogLevel, ILogtailLog, Context } from "@logtail/types";

import { LogtailTransport } from "./winston";

// Sample log message
const message = "Something to do with something";

/**
 * Test a Winston level vs. Logtail level
 * @param level - Winston log level
 * @param logLevel LogLevel - Logtail log level
 * @param levels Use custom log levels
 */
async function testLevel(level: string, logLevel: LogLevel, levels?: { [key: string]: number }) {
  // Sample log
  const log: LogEntry = {
    level,
    message,
  };

  // Logtail fixtures
  const logtail = new Logtail("test", { throwExceptions: true });
  const logged = new Promise<ILogtailLog[]>((resolve) => {
    logtail.setSync(async (logs) => {
      resolve(logs);
      return logs;
    });
  });

  // Create a Winston logger
  const logger = winston.createLogger({
    level,
    transports: [new LogtailTransport(logtail)],
    // use custom levels if passed
    levels: levels || winston.config.npm.levels,
  });

  // Log it!
  logger.log(log);

  const logs = await logged;

  // Should be exactly one log
  expect(logs.length).toBe(1);

  // Message should match
  expect(logs[0].message).toBe(log.message);

  // Log level should be 'logLevel'
  expect(logs[0].level).toBe(logLevel);
}

describe("Winston logging tests", () => {
  const levels: { [key: string]: LogLevel } = {
    silly: LogLevel.Silly,
    debug: LogLevel.Debug,
    http: LogLevel.Http,
    verbose: LogLevel.Verbose,
    warn: LogLevel.Warn,
    error: LogLevel.Error,
  };
  for (const key in levels) {
    it(`should log at the '${key}' level`, async () => {
      return testLevel(key, levels[key]);
    });
  }

  it("should sync multiple logs", async () => {
    // Create multiple log entries
    const entries: LogEntry[] = [
      {
        level: "info",
        message: `${message} 1`,
      },
      {
        level: "debug",
        message: `${message} 2`,
      },
      {
        level: "warn",
        message: `${message} 3`,
      },
      {
        level: "error",
        message: `${message} 4`,
      },
    ];

    // Fixtures
    const logtail = new Logtail("test", {
      throwExceptions: true,
      batchInterval: 1000, // <-- shouldn't be exceeded
      batchSize: entries.length,
    });

    logtail.setSync(async (logs) => {
      expect(logs.length).toBe(entries.length);

      // Logs should be identical
      const isIdentical = logs.every(
        (log) =>
          entries.findIndex((entry) => {
            return entry.message == log.message;
          }) > -1,
      );
      expect(isIdentical).toBe(true);

      return logs;
    });

    // Create a Winston logger
    const logger = winston.createLogger({
      level: "debug", // <-- debug and above
      transports: [new LogtailTransport(logtail)],
    });

    entries.forEach((entry) => logger.log(entry.level, entry.message));
  });

  it("should log metadata with the message and level", async () => {
    const logtail = new Logtail("test", { throwExceptions: true });
    const logged = new Promise<ILogtailLog[]>((resolve) => {
      logtail.setSync(async (logs) => {
        resolve(logs);
        return logs;
      });
    });

    // Create a Winston logger
    const logger = winston.createLogger({
      level: LogLevel.Info,
      transports: [new LogtailTransport(logtail)],
    });

    // Log it!
    logger.log(LogLevel.Info, "a test message", { request_id: 123 });

    const logs = await logged;

    // Should be exactly one log
    expect(logs.length).toBe(1);

    // Message should match
    expect(logs[0].message).toBe("a test message");

    // Log level should be 'info'
    expect(logs[0].level).toBe(LogLevel.Info);

    expect(logs[0]["request_id"]).toBe(123);
  });

  it("should log defaultMetadata with the message and level", async () => {
    const logtail = new Logtail("test", { throwExceptions: true });
    const logged = new Promise<ILogtailLog[]>((resolve) => {
      logtail.setSync(async (logs) => {
        resolve(logs);
        return logs;
      });
    });

    // Create a Winston logger
    const logger = winston.createLogger({
      level: LogLevel.Info,
      transports: [new LogtailTransport(logtail)],
      defaultMeta: {
        component: "server",
      },
    });

    // Log it!
    logger.log(LogLevel.Info, "a test message", { request_id: 123 });

    const logs = await logged;

    // Should be exactly one log
    expect(logs.length).toBe(1);

    // Message should match
    expect(logs[0].message).toBe("a test message");

    // Log level should be 'info'
    expect(logs[0].level).toBe(LogLevel.Info);

    expect(logs[0]["request_id"]).toBe(123);
    expect(logs[0]["component"]).toBe("server");
  });

  it("should include correct context fields", async () => {
    const logtail = new Logtail("test", { throwExceptions: true });
    const logged = new Promise<ILogtailLog[]>((resolve) => {
      logtail.setSync(async (logs) => {
        resolve(logs);
        return logs;
      });
    });

    // Create a Winston logger
    const logger = winston.createLogger({
      level: LogLevel.Info,
      transports: [new LogtailTransport(logtail)],
      defaultMeta: {
        component: "server",
      },
    });

    logger.info("message with context");

    const logs = await logged;

    const context = logs[0].context;
    expect(context.runtime.file).toMatch("winston.test.ts");
  });

  it("should flush logtail when the logger is closed", async () => {
    let logs: ILogtailLog[] = [];

    const logtail = new Logtail("test", { throwExceptions: true });

    logtail.setSync(async (_logs: ILogtailLog[]) => {
      logs.push(..._logs);
      return logs;
    });

    const logger = winston.createLogger({
      level: LogLevel.Info,
      transports: [new LogtailTransport(logtail)],
    });

    const finished = new Promise<void>((resolve) => {
      logger.on("finish", resolve);
    });

    // Act
    logger.info("a test message");
    logger.end();

    await finished;

    // Should be exactly one log
    expect(logs.length).toBe(1);

    // Message should match
    expect(logs[0].message).toBe("a test message");
  });
});
