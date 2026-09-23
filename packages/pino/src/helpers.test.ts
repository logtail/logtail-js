import { LogLevel } from "@logtail/types";

import { getLogLevel, parseCustomLevels } from "./helpers";

describe("parseCustomLevels", () => {
  it("should map level numbers to names from an object", () => {
    expect(parseCustomLevels({ notice: 35, critical: 55 })).toEqual({ 35: "notice", 55: "critical" });
  });

  it("should map level numbers to names from a comma-separated string", () => {
    expect(parseCustomLevels("notice:35, critical:55")).toEqual({ 35: "notice", 55: "critical" });
  });

  it("should map nothing without custom levels", () => {
    expect(parseCustomLevels(undefined)).toEqual({});
  });
});

describe("getLogLevel", () => {
  it("should map Pino's default level numbers", () => {
    expect([10, 20, 30, 40, 50, 60].map((level) => getLogLevel(level))).toEqual([
      LogLevel.Trace,
      LogLevel.Debug,
      LogLevel.Info,
      LogLevel.Warn,
      LogLevel.Error,
      LogLevel.Fatal,
    ]);
  });

  it("should use the name of a custom level", () => {
    expect(getLogLevel(35, { 35: "notice" })).toBe("notice");
  });

  it("should let custom names override the default ones", () => {
    expect(getLogLevel(30, { 30: "information" })).toBe("information");
  });

  it("should fall back to the closest default level for unnamed numbers", () => {
    expect([5, 25, 45, 70].map((level) => getLogLevel(level, { 35: "notice" }))).toEqual([
      LogLevel.Trace,
      LogLevel.Info,
      LogLevel.Error,
      LogLevel.Fatal,
    ]);
  });

  it("should pass level labels from a level formatter through", () => {
    expect(["WARN", "notice", "50"].map((level) => getLogLevel(level))).toEqual([
      LogLevel.Warn,
      "notice",
      LogLevel.Error,
    ]);
  });
});
