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
  // Awaiting: https://bugs.chromium.org/p/chromium/issues/detail?id=571722

  // it("should set a User-Agent based on the right version number", () => {
  //   const expectedValue = `logtail-js(browser)/${version}`;
  //   const actualValue = getUserAgent();
  //   expect(actualValue).toEqual(expectedValue);
  // });

  it("should echo log if logtail sends 20x status code", async done => {
    nock("https://in.logtail.com")
      .post("/")
      .reply(201);

    const message: string = String(Math.random());
    const expectedLog = getRandomLog(message);
    const browser = new Browser("valid source token");
    const echoedLog = await browser.log(message);
    expect(echoedLog.message).toEqual(expectedLog.message);

    done();
  });

  it("should throw error if logtail sends non 200 status code", async done => {
    nock("https://in.logtail.com")
      .post("/")
      .reply(401);

    const browser = new Browser("invalid source token", {
      ignoreExceptions: false,
      throwExceptions: true,
    });
    const message: string = String(Math.random);
    await expect(browser.log(message)).rejects.toThrow();

    done();
  });
});
