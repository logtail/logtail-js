import {base64Encode, sanitizeContext} from "./encode";
import {ILogtailOptions} from "@logtail/types";

describe("Encode function tests", () => {
  // Fixtures
  const ascii = "hello world";
  const base64 = "aGVsbG8gd29ybGQ=";

  it("should convert plain text to base64", () => {
    expect(base64Encode(ascii)).toEqual(base64);
  });
});

describe("Function sanitizeContext", () => {
  // Fixtures
  const options: ILogtailOptions = {
    endpoint: "https://in.logtail.com",
    batchSize: 1000,
    batchInterval: 1000,
    retryCount: 3,
    retryBackoff: 100,
    syncMax: 5,
    burstProtectionMilliseconds: 5000,
    burstProtectionMax: 10000,
    ignoreExceptions: false,
    throwExceptions: false,
    contextObjectMaxDepth: 3,
    contextObjectMaxDepthWarn: false,
    contextObjectCircularRefWarn: false,
    sendLogsToConsoleOutput: false,
    sendLogsToBetterStack: true,
  };

  it("should keep string as is", () => {
    expect(sanitizeContext("my string", options)).toEqual("my string");
  });

  it("should keep number as is", () => {
    expect(sanitizeContext(123.456, options)).toEqual(123.456);
  });

  it("should keep boolean as is", () => {
    expect(sanitizeContext(true, options)).toEqual(true);
  });

  it("should keep array", () => {
    expect(sanitizeContext([1,2,3], options)).toEqual([1,2,3]);
  });

  it("should format dates in UTC", () => {
    expect(sanitizeContext(new Date("2015-03-14T12:30:00.001+08:00"), options)).toEqual("2015-03-14T04:30:00.001Z");
  });

  it("should keep shallow object as is", () => {
    expect(sanitizeContext({foo: "bar", nested: {a: 1, b: 2}}, options))
        .toEqual({foo: "bar", nested: {a: 1, b: 2}});
  });

  it("should serialize details of Errors", () => {
    const sanitizedError = sanitizeContext(new Error("My testing error"), options)
    expect(sanitizedError.name).toEqual("Error");
    expect(sanitizedError.message).toEqual("My testing error");
    expect(sanitizedError.stack).toBeInstanceOf(Array);
  });

  it("should truncate deep object", () => {
    expect(sanitizeContext({very: {deeply: {nested: {object: {}}}}}, options))
        .toEqual({very: {deeply: {nested: "<omitted context beyond configured max depth: 3>"}}});
  });

  it("should omit circular dependencies", () => {
    const batman = {name: "Batman", sidekick: {}};
    batman.sidekick = {name: "Robin", hero: batman};
    expect(sanitizeContext(batman, options))
        .toEqual({name: "Batman", sidekick: {name: "Robin", hero: "<omitted circular reference>"}});
  });
});
