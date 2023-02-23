import { LogLevel } from "@logtail/types";

/**
 * Return a Logtail `LogLevel` based on the Bunyan level
 * @param level string|number - Bunyan log level
 */
export function getLogLevel(level: number | string): LogLevel {
  // Are we dealing with a string log level?
  if (typeof level === "string") {
    switch (level.toLowerCase()) {
      // Fatal
      case "fatal":
        return LogLevel.Fatal;

      // Error
      case "error":
        return LogLevel.Error;

      // Warn
      case "warn":
        return LogLevel.Warn;

      // Debug
      case "debug":
        return LogLevel.Debug;

      // Trace
      case "trace":
        return LogLevel.Trace;

    }
  } else if (typeof level === "number") {
    // Trace
    if (level <= 10) {
      return LogLevel.Trace;
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

    // Error
    if (level <= 50) {
      return LogLevel.Error;
    }

    // Everything above this level is considered fatal
    return LogLevel.Fatal;
  }

  // By default, return info
  return LogLevel.Info;
}
