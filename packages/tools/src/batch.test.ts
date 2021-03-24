import nock from "nock";
import fetch from "cross-fetch";
import { ILogtailLog, LogLevel } from "@logtail/types";
import makeBatch from "./batch";
import makeThrottle from "./throttle";

/**
 * Create a log with a random string / current date
 */
function getRandomLog(): ILogtailLog {
  return {
    dt: new Date(),
    level: LogLevel.Info,
    message: String(Math.random())
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
  it("should not fire timeout while a send was happening.", async done => {
    nock("http://example.com")
      .get("/")
      .reply(200, new Promise(res => setTimeout(() => res(200), 1003)));

    const called = jest.fn();
    const size = 5;
    const sendTimeout = 10;

    const batcher = makeBatch(size, sendTimeout);
    const logger = batcher(async (batch: ILogtailLog[]) => {
      called();
      try {
        await fetch("http://example.com");
      } catch (e) {
        throw e;
      }
    });

    await Promise.all(logNumberTimes(logger, 5)).catch(e => {
      throw e;
    });
    expect(called).toHaveBeenCalledTimes(1);
    nock.restore();
    done();
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
    const throttler = throttle(async logs => {
      return new Promise(resolve => {
        setTimeout(() => resolve(logs), throttleResolveAfter);
      });
    });

    // Store the throttled promises in an array
    const promises = [];

    // Create a batcher that 'emits' after `batchSize` logs
    const batch = makeBatch(batchSize, 5000);

    // The batcher should be throttled
    const batcher = batch((logs: any) => {
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
    const expectedTime =
      ((numberOfLogs / batchSize) * throttleResolveAfter) / maxThrottle;

    expect(end).toBeGreaterThanOrEqual(expectedTime);
  });
});
