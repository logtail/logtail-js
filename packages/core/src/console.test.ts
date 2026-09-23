import { formatConsoleArgs } from "./console";

describe("formatConsoleArgs", () => {
  it("should join strings and other primitives into the message", () => {
    expect(formatConsoleArgs(["Loaded", 3, "items in", 1.5, "s", true, null, undefined])).toEqual({
      message: "Loaded 3 items in 1.5 s true null undefined",
      context: {},
    });
  });

  it("should merge plain objects into the context", () => {
    expect(formatConsoleArgs(["User logged in", { user_id: 42 }, { plan: "pro" }])).toEqual({
      message: "User logged in",
      context: { user_id: 42, plan: "pro" },
    });
  });

  it("should keep the first error as `error` and print every error in the message", () => {
    const error = new Error("boom");
    const later = new TypeError("later");

    const { message, context } = formatConsoleArgs(["Request failed", error, later]);

    expect(message).toBe("Request failed Error: boom TypeError: later");
    expect(context.error).toBe(error);
    expect(Object.keys(context)).toEqual(["error"]);
  });

  it("should stringify arrays, dates, class instances and functions into the message", () => {
    class Point {
      constructor(
        public x: number,
        public y: number,
      ) {}
    }
    function handler() {}

    expect(
      formatConsoleArgs(["ids", [1, 2, 3], "at", new Date("2024-01-01T00:00:00Z"), new Point(1, 2), handler]),
    ).toEqual({
      message: 'ids [1,2,3] at 2024-01-01T00:00:00.000Z {"x":1,"y":2} [Function: handler]',
      context: {},
    });
  });

  it("should substitute printf-style placeholders in a leading format string", () => {
    expect(
      formatConsoleArgs(["%s logged in %d times (%j) %o %%", "alice", "3", { a: 1 }, [1], "extra", { b: 2 }]),
    ).toEqual({
      message: 'alice logged in 3 times ({"a":1}) [1] % extra',
      context: { b: 2 },
    });
  });

  it("should leave placeholders without a matching argument alone", () => {
    expect(formatConsoleArgs(["100% sure %s"])).toEqual({ message: "100% sure %s", context: {} });
  });

  it("should fall back to String() for values JSON cannot serialize", () => {
    const circular: any[] = [];
    circular.push(circular);

    expect(formatConsoleArgs([circular, BigInt(10), Symbol("tag")])).toEqual({
      message: "[object Array] 10 Symbol(tag)",
      context: {},
    });
  });

  it("should produce an empty message for a call without arguments", () => {
    expect(formatConsoleArgs([])).toEqual({ message: "", context: {} });
  });
});
