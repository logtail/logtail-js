import nock from "nock";
import { ILogtailLog, LogLevel } from "@logtail/types";
import makeBatch, { calculateJsonLogSizeBytes } from "./batch";
import makeThrottle from "./throttle";

/**
 * Create a log with a random string / current date
 */
function getRandomLog(): ILogtailLog {
  return {
    dt: new Date(),
    level: LogLevel.Info,
    message: String(Math.random()),
  };
}

/**
 * Returns an `n` sized array of logger functions
 *
 * @param logger - Logger function to pass in `getRandomLog()`
 * @param n - Number of functions to return
 */
function logNumberTimes(logger: Function, n: number): Function[] {
  return [...Array(n).keys()].map(() => logger(getRandomLog()));
}

/**
 * Calculate end time in milliseconds
 * @param start: [number, number] = NodeJS `process.hrtime` start time
 */
function calcEndTime(start: [number, number]): number {
  const end = process.hrtime(start);
  return (end[0] * 1e9 + end[1]) / 1e6;
}

describe("batch tests", () => {
  beforeEach(() => {
    nock.restore();
    nock.activate();
  });
  afterEach(() => {
    nock.restore();
  });

  it("should not fire timeout while a send was happening.", async () => {
    nock("http://example.com")
      .get("/")
      .reply(200, new Promise((res) => setTimeout(() => res(200), 1003)));

    const called = jest.fn();
    const size = 5;
    const sendTimeout = 10;

    const batcher = makeBatch(size, sendTimeout);
    const logger = batcher.initPusher(async (batch: ILogtailLog[]) => {
      called();
      try {
        await fetch("http://example.com");
      } catch (e) {
        throw e;
      }
    });

    await Promise.all(logNumberTimes(logger, 5)).catch((e) => {
      throw e;
    });
    expect(called).toHaveBeenCalledTimes(1);
  });

  it("should retry 3 times.", async () => {
    const called = jest.fn();
    const size = 5;
    const sendTimeout = 10;
    const retryCount = 3;
    const retryBackoff = 1;
    const err = new Error("test");

    const batcher = makeBatch(size, sendTimeout, retryCount, retryBackoff);
    const logger = batcher.initPusher(async (batch: ILogtailLog[]) => {
      called();
      throw err;
    });

    await Promise.all(logNumberTimes(logger, 5)).catch((e) => {});
    expect(called).toHaveBeenCalledTimes(4); // 3 retries + 1 initial
  });

  it("await flush waits for all retries", async () => {
    const called = jest.fn();
    const size = 5;
    const sendTimeout = 10;
    const retryCount = 3;
    const retryBackoff = 1;
    const err = new Error("test");

    const batcher = makeBatch(size, sendTimeout, retryCount, retryBackoff);
    const logger = batcher.initPusher(async (batch: ILogtailLog[]) => {
      called();
      throw err;
    });

    logger(getRandomLog()).catch((e) => {});
    await batcher.flush();

    expect(called).toHaveBeenCalledTimes(4); // 3 retries + 1 initial
  });

  it("should play nicely with `throttle`", async () => {
    // Fixtures
    const maxThrottle = 2;
    const throttleResolveAfter = 1000; // ms
    const batchSize = 5;
    const numberOfLogs = 20;

    // Create a throttle that processes 1 pipeline at once
    const throttle = makeThrottle(maxThrottle);

    // Resolve the throttler after 1 second
    const throttler = throttle(async (logs) => {
      return new Promise((resolve) => {
        setTimeout(() => resolve(logs), throttleResolveAfter);
      });
    });

    // Store the throttled promises in an array
    const promises = [];

    // Create a batcher that 'emits' after `batchSize` logs
    const batch = makeBatch(batchSize, 5000);

    // The batcher should be throttled
    const batcher = batch.initPusher((logs: any) => {
      expect(logs.length).toEqual(batchSize);
      return throttler(logs);
    });

    // Start the timer
    const start = process.hrtime();

    // Fire off a bunch of logs into the batcher
    for (let i = 0; i < numberOfLogs; i++) {
      promises.push(batcher(getRandomLog()));
    }

    // Await batching and throttling
    await Promise.all(promises);

    // Get the time once all promises have been fulfilled
    const end = calcEndTime(start);

    // Expect time to have taken at least this long...
    const expectedTime = ((numberOfLogs / batchSize) * throttleResolveAfter) / maxThrottle;
    const toleranceMilliseconds = 0.2;

    expect(end).toBeGreaterThanOrEqual(expectedTime - toleranceMilliseconds);
  });

  it("should send after flush (with long timeout)", async () => {
    nock("http://example.com")
      .get("/")
      .reply(200, new Promise((res) => setTimeout(() => res(200), 1003)));

    const called = jest.fn();
    const size = 50;
    const sendTimeout = 10000;

    const batcher = makeBatch(size, sendTimeout);
    const logger = batcher.initPusher(async (batch: ILogtailLog[]) => {
      called();
      try {
        await fetch("http://example.com");
      } catch (e) {
        throw e;
      }
    });

    logNumberTimes(logger, 5);
    expect(called).toHaveBeenCalledTimes(0);
    try {
      await batcher.flush();
    } catch (e) {
      throw e;
    }
    expect(called).toHaveBeenCalledTimes(1);
  });

  it("should send large logs in multiple batches", async () => {
    const called = jest.fn();
    const size = 1000;
    const sendTimeout = 1000;
    const retryCount = 0;
    const retryBackoff = 0;

    // Every log is calculated to have 50B and there's 500B limit
    const sizeBytes = 500;
    const calculateSize = (_log: ILogtailLog) => 50;

    const batcher = makeBatch(size, sendTimeout, retryCount, retryBackoff, sizeBytes, calculateSize);
    const logger = batcher.initPusher(async (_batch: ILogtailLog[]) => {
      called();
    });

    // 100 logs with 50B each is 5000B in total - expecting 10 batches of 500B
    await Promise.all(logNumberTimes(logger, 100)).catch((e) => {
      throw e;
    });
    expect(called).toHaveBeenCalledTimes(10);
  });
});

describe("JSON log size calculator", () => {
  it("should calculate log size as JSON length", async () => {
    const log: ILogtailLog = {
      dt: new Date(),
      level: LogLevel.Info,
      message: "My message",
    };

    const actualLogSizeBytes = calculateJsonLogSizeBytes(log);
    const expectedLogSizeBytes = '{"dt":"????-??-??T??:??:??.???Z","level":"INFO","message":"My message"},'.length;

    expect(actualLogSizeBytes).toEqual(expectedLogSizeBytes);
  });
});
