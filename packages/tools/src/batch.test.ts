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

  it("should not call the send function when flushing an empty buffer", async () => {
    const called = jest.fn();
    const batcher = makeBatch(5, 10000);
    batcher.initPusher(async (_batch: ILogtailLog[]) => {
      called();
    });

    await batcher.flush();

    expect(called).toHaveBeenCalledTimes(0);
  });

  it("should not send again when flushing right after a send", async () => {
    const called = jest.fn();
    const batcher = makeBatch(5, 10000);
    const logger = batcher.initPusher(async (_batch: ILogtailLog[]) => {
      called();
    });

    const logged = logNumberTimes(logger, 3);
    await batcher.flush();
    await Promise.all(logged);
    await batcher.flush();

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

  it("should send right away when sending immediately, one send at a time", async () => {
    const sent: number[] = [];
    let finishFirst!: () => void;
    const batcher = makeBatch(1000, 10000, 3, 100, 0, calculateJsonLogSizeBytes, { sendImmediately: true });
    const logger = batcher.initPusher(async (batch: ILogtailLog[]) => {
      sent.push(batch.length);
      if (sent.length === 1) {
        await new Promise<void>((resolve) => (finishFirst = resolve));
      }
    });

    // Logs pushed in the same tick go in one send, without waiting for the flush timeout
    const first = logNumberTimes(logger, 2);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(sent).toEqual([2]);

    // Logs pushed while that send is in progress go in one send right after it
    const during = logNumberTimes(logger, 3);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(sent).toEqual([2]);
    finishFirst();
    await Promise.all([...first, ...during]);
    expect(sent).toEqual([2, 3]);
  });

  it("should flush the logs pushed during a send once that send is done, when sending immediately", async () => {
    const sent: number[] = [];
    let finishFirst!: () => void;
    const batcher = makeBatch(1000, 10000, 3, 100, 0, calculateJsonLogSizeBytes, { sendImmediately: true });
    const logger = batcher.initPusher(async (batch: ILogtailLog[]) => {
      sent.push(batch.length);
      if (sent.length === 1) {
        await new Promise<void>((resolve) => (finishFirst = resolve));
      }
    });

    logger(getRandomLog());
    await new Promise((resolve) => setTimeout(resolve, 10));
    logger(getRandomLog());
    const flushed = batcher.flush();
    finishFirst();
    await flushed;

    expect(sent).toEqual([1, 1]);
  });

  it("should retry a failed send after the flush timeout, when sending immediately", async () => {
    const start = Date.now();
    const sentAt: number[] = [];
    const batcher = makeBatch(1000, 50, 1, 0, 0, calculateJsonLogSizeBytes, { sendImmediately: true });
    const logger = batcher.initPusher(async () => {
      sentAt.push(Date.now() - start);
      if (sentAt.length === 1) {
        throw new Error("outage");
      }
    });

    await logger(getRandomLog());

    expect(sentAt).toHaveLength(2);
    expect(sentAt[0]).toBeLessThan(40);
    expect(sentAt[1] - sentAt[0]).toBeGreaterThanOrEqual(45);
  });

  it("should send the logs taken along from another batch with its own, and retry them together", async () => {
    const sent: string[][] = [];
    const other = makeBatch(1000, 10000);
    const pushOther = other.initPusher(async () => {});
    const batcher = makeBatch(1000, 20, 3, 0, 0, calculateJsonLogSizeBytes, {
      sendImmediately: true,
      takeAlong: other.take,
    });
    const push = batcher.initPusher(async (batch: ILogtailLog[]) => {
      sent.push(batch.map((log) => log.message));
      if (sent.length === 1) {
        throw new Error("outage");
      }
    });

    const waiting = pushOther({ ...getRandomLog(), message: "waiting" });
    await Promise.all([push({ ...getRandomLog(), message: "own" }), waiting]);

    expect(sent).toEqual([
      ["waiting", "own"],
      ["waiting", "own"],
    ]);
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
