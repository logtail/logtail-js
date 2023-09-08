import { LogLevel, ILogLevel } from "@logtail/types";

/**
 * Return a Logtail `LogLevel` based on the Bunyan level
 * @param level string|number - Bunyan log level
 */
export function getLogLevel(level: number | string): ILogLevel {
  // Are we dealing with a string log level?
  if (typeof level === "string") {
    return level.toLowerCase();
  }
  if (typeof level === "number") {
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
