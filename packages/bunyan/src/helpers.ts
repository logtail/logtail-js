import { LogLevel } from "@logtail/types";

/**
 * Return a Logtail `LogLevel` based on the Bunyan level
 * @param level string|number - Bunyan log level
 */
export function getLogLevel(level: number | string): LogLevel {
  // Are we dealing with a string log level?
  if (typeof level === "string") {
    switch (level.toLowerCase()) {
      // Trace is ignored
      case "trace":
        throw new Error();

      // Error
      case "fatal":
      case "error":
        return LogLevel.Error;

      // Warn
      case "warn":
        return LogLevel.Warn;

      // Debug
      case "debug":
        return LogLevel.Debug;
    }
  } else if (typeof level === "number") {
    // If level <=, consider it 'tracing' and move on
    if (level <= 10) {
      throw new Error();
    }

    // Debug
    if (level <= 20) {
      return LogLevel.Debug;
    }

    // Info
    if (level <= 30) {
      return LogLevel.Info;
    }

    // Warn
    if (level <= 40) {
      return LogLevel.Warn;
    }

    // Everything above this level is considered an error
    return LogLevel.Error;
  }

  // By default, return info
  return LogLevel.Info;
}
