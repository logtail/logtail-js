import nock from "nock";
import { base64Encode } from "@logtail/tools";
import { ILogtailLog } from "@logtail/types";

import { Browser } from "./browser";

/**
 * Create a log with a random string / current date
 */
function getRandomLog(message: string): Partial<ILogtailLog> {
  return {
    message,
  };
}

// set new property btoa in node environment to run the tests
(global as any).btoa = base64Encode;

describe("browser tests", () => {
  beforeEach(() => {
    nock.restore();
    nock.activate();
  });
  afterEach(() => {
    nock.cleanAll();
    nock.restore();
  });

  // Awaiting: https://bugs.chromium.org/p/chromium/issues/detail?id=571722

  // it("should set a User-Agent based on the right version number", () => {
  //   const expectedValue = `logtail-js(browser)/${version}`;
  //   const actualValue = getUserAgent();
  //   expect(actualValue).toEqual(expectedValue);
  // });

  it("should echo log if logtail sends 20x status code", async () => {
    nock("https://in.logs.betterstack.com").post("/").reply(201);

    const message: string = String(Math.random());
    const expectedLog = getRandomLog(message);
    const browser = new Browser("valid source token", {
      throwExceptions: true,
    });
    const echoedLog = await browser.log(message);
    expect(echoedLog.message).toEqual(expectedLog.message);
  });

  it("should throw error if logtail sends non 200 status code", async () => {
    nock("https://in.logs.betterstack.com").post("/").reply(401);

    const browser = new Browser("invalid source token", {
      throwExceptions: true,
    });
    const message: string = String(Math.random);
    await expect(browser.log(message)).rejects.toThrow();
  });

  it("should split large logs into multiple batches to avoid 64 KiB limit on keepalive requests", async () => {
    let calledCount = 0;

    nock("https://in.logs.betterstack.com")
      .post("/")
      .twice()
      .reply(201, () => {
        calledCount++;
      });

    const browser = new Browser("valid source token", {
      throwExceptions: true,
      batchInterval: 100,
    });

    // 6 logs, each over 12 KiB (each logs also contains context, datetime, etc.)
    const over12KiB = "X".repeat(13000);
    await Promise.all([...Array(6)].map(() => browser.log(over12KiB)));

    expect(calledCount).toEqual(2);
  });

  it("should keep requests under the 64 KiB keepalive limit when a failed send is retried", async () => {
    const bodySizes: number[] = [];
    const recordBodySize = (_uri: string, body: any) => {
      bodySizes.push(JSON.stringify(body).length);
      return "";
    };
    nock("https://in.logs.betterstack.com")
      .post("/")
      .reply(503, recordBodySize)
      .post("/")
      .times(5)
      .reply(201, recordBodySize);

    const browser = new Browser("valid source token", {
      throwExceptions: true,
      batchInterval: 100,
    });

    // 4 logs, each over 12 KiB, reach 48 KiB and are sent, which fails
    const over12KiB = "X".repeat(13000);
    const logged = [...Array(4)].map(() => browser.log(over12KiB));
    await new Promise((resolve) => setTimeout(resolve, 20));
    // Logged while the failed logs wait to be retried
    logged.push(browser.log(over12KiB), browser.log(over12KiB));
    await Promise.all(logged);

    expect(Math.max(...bodySizes)).toBeLessThan(64 * 1024);
  });

  it("should be able to sent 100 small logs in a single batch", async () => {
    let calledCount = 0;

    nock("https://in.logs.betterstack.com")
      .post("/")
      .reply(201, () => {
        calledCount++;
      });

    const browser = new Browser("valid source token", {
      throwExceptions: true,
      batchInterval: 100,
    });

    await Promise.all([...Array(100)].map(() => browser.log("small")));

    expect(calledCount).toEqual(1);
  });
});
