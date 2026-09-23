import { Context, LogLevel } from "@logtail/types";

export type ConsoleMethod = "debug" | "log" | "info" | "warn" | "error";

/**
 * Log level of each forwarded console method
 */
export const consoleMethodLevels: Record<ConsoleMethod, LogLevel> = {
  debug: LogLevel.Debug,
  log: LogLevel.Info,
  info: LogLevel.Info,
  warn: LogLevel.Warn,
  error: LogLevel.Error,
};

export const consoleMethods = Object.keys(consoleMethodLevels) as ConsoleMethod[];

/**
 * Turns the arguments of a console call into a log message and context: strings and other primitives form
 * the message the way the console prints them (including printf-style placeholders in a leading format string),
 * plain objects become context fields, and the first Error becomes the `error` context field while every
 * error is also printed in the message.
 *
 * @param args - Arguments passed to the console method
 */
export function formatConsoleArgs(args: any[]): { message: string; context: Context } {
  const context: Context = {};
  const parts: string[] = [];
  let rest = args;

  if (typeof args[0] === "string" && args[0].includes("%")) {
    const [formatted, remaining] = applyPlaceholders(args[0], args.slice(1));
    parts.push(formatted);
    rest = remaining;
  }

  for (const arg of rest) {
    if (arg instanceof Error) {
      if (context.error === undefined) {
        context.error = arg;
      }
      parts.push(String(arg));
    } else if (isPlainObject(arg)) {
      Object.assign(context, arg);
    } else {
      parts.push(stringify(arg));
    }
  }

  return { message: parts.join(" "), context };
}

/**
 * Substitutes `%s`, `%d`, `%i`, `%f`, `%j`, `%o`, `%O` and `%c` with the following arguments, like `util.format()`
 *
 * @returns The formatted string and the arguments that were not consumed
 */
function applyPlaceholders(format: string, args: any[]): [string, any[]] {
  let consumed = 0;

  const formatted = format.replace(/%[sdifjoOc%]/g, (placeholder) => {
    if (placeholder === "%%") {
      return "%";
    }
    if (consumed >= args.length) {
      return placeholder;
    }

    const arg = args[consumed++];
    switch (placeholder) {
      case "%d":
        return String(Number(arg));
      case "%i":
        return String(parseInt(arg, 10));
      case "%f":
        return String(parseFloat(arg));
      case "%c":
        return "";
      default:
        return stringify(arg);
    }
  });

  return [formatted, args.slice(consumed)];
}

function isPlainObject(value: any): value is Record<string, any> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function stringify(value: any): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "function") {
    return `[Function: ${value.name || "anonymous"}]`;
  }
  if (typeof value !== "object" || value === null) {
    return String(value);
  }
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? String(value) : value.toISOString();
  }

  try {
    const json = JSON.stringify(value);
    return json === undefined ? Object.prototype.toString.call(value) : json;
  } catch (_) {
    return Object.prototype.toString.call(value);
  }
}
