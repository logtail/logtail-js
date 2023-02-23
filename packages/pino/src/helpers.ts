import { LogLevel } from "@logtail/types";

/**
 * Return a Logtail `LogLevel` based on the Pino level
 * @param level number - Pino log level
 */
export function getLogLevel(level: number): LogLevel {
  // Trace 10
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
