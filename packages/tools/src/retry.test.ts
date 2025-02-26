import { ILogtailLog, LogLevel } from "@logtail/types";
import nock from "nock";
import makeRetry from "./retry";

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

function makeSync(called: Function) {
  return async function sync(logs: ILogtailLog[]): Promise<ILogtailLog[]> {
    try {
      const res = await fetch("http://example.com");
      if (res.ok) {
        return Promise.resolve(logs);
      }
      throw new Error("failed!");
    } catch (e) {
      called();
      throw e;
    }
  };
}

describe("retry tests", () => {
  it("no failure with correct timing", async () => {
    const called = jest.fn();
    const logs: ILogtailLog[] = [getRandomLog()];

    nock("http://example.com").get("/").reply(200, logs);

    const sync = makeSync(called);
    const retry = await makeRetry(sync);
    const expectedLogs = await retry(logs);
    expect(called).toHaveBeenCalledTimes(0);
  });

  it("one failure with correct timing", async () => {
    const called = jest.fn();
    const logs: ILogtailLog[] = [getRandomLog()];

    nock("http://example.com").get("/").reply(500, "Bad").get("/").reply(200, logs);

    const sync = makeSync(called);
    const retry = await makeRetry(sync);
    const expectedLogs = await retry(logs);
    expect(called).toHaveBeenCalledTimes(1);
  }, 3500);

  it("two failure with correct timing", async () => {
    const called = jest.fn();
    const logs: ILogtailLog[] = [getRandomLog()];

    nock("http://example.com").get("/").reply(500, "Bad").get("/").reply(500, "Bad").get("/").reply(200, logs);

    const sync = makeSync(called);
    const retry = await makeRetry(sync);
    const expectedLogs = await retry(logs);
    expect(called).toHaveBeenCalledTimes(2);
  }, 7000);

  it("three failure with correct timing", async () => {
    const called = jest.fn();
    const logs: ILogtailLog[] = [getRandomLog()];

    nock("http://example.com")
      .get("/")
      .reply(500, "Bad")
      .get("/")
      .reply(500, "Bad")
      .get("/")
      .reply(500, "Bad")
      .get("/")
      .reply(200, logs);

    const sync = makeSync(called);
    const retry = await makeRetry(sync);
    try {
      const expectedLogs = await retry(logs);
    } catch {
      expect(called).toHaveBeenCalledTimes(3);
    }
  }, 7500);
});
