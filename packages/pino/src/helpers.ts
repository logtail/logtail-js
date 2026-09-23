import { ILogLevel, LogLevel } from "@logtail/types";

/**
 * Names of Pino's default levels
 */
const defaultLevelNames: Record<number, string> = {
  10: LogLevel.Trace,
  20: LogLevel.Debug,
  30: LogLevel.Info,
  40: LogLevel.Warn,
  50: LogLevel.Error,
  60: LogLevel.Fatal,
};

/**
 * Turns the `customLevels` transport option, `{ notice: 35 }` or `"notice:35,critical:55"`, into level names by number
 *
 * @param customLevels - Custom Pino levels
 */
export function parseCustomLevels(customLevels?: Record<string, number> | string): Record<number, string> {
  const names: Record<number, string> = {};

  if (typeof customLevels === "string") {
    customLevels.split(",").forEach((entry) => {
      const [name, value] = entry.split(":").map((part) => part.trim());
      if (name && value && !isNaN(Number(value))) {
        names[Number(value)] = name;
      }
    });
  } else if (customLevels) {
    Object.entries(customLevels).forEach(([name, value]) => (names[value] = name));
  }

  return names;
}

/**
 * Return the Better Stack log level for a Pino level: the name Pino or the `customLevels` option gives the number,
 * a label produced by a Pino level formatter as it is, or the closest default level for numbers without a name
 *
 * @param level - Pino log level, a number or a label
 * @param levelNames - Level names by number, on top of Pino's defaults
 */
export function getLogLevel(level: number | string, levelNames: Record<number, string> = {}): ILogLevel {
  if (typeof level === "string" && isNaN(Number(level))) {
    return level.toLowerCase();
  }

  const value = Number(level);
  const name = levelNames[value] ?? defaultLevelNames[value];
  if (name) {
    return name;
  }

  // Trace 10
  if (value <= 10) {
    return LogLevel.Trace;
  }

  // Debug
  if (value <= 20) {
    return LogLevel.Debug;
  }

  // Info
  if (value <= 30) {
    return LogLevel.Info;
  }

  // Warn
  if (value <= 40) {
    return LogLevel.Warn;
  }

  // Error
  if (value <= 50) {
    return LogLevel.Error;
  }
  // Everything above this level is considered fatal
  return LogLevel.Fatal;
}
