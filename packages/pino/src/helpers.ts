import { Context, ILogLevel, LogLevel, StackContextHint } from "@logtail/types";

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
 * Configuration Pino 8.21+ shares with its destinations right after the logger is created
 */
export interface IPinoConfig {
  levels?: { labels: Record<number, string>; values: Record<string, number> };
  messageKey?: string;
}

/**
 * Stack frames of Pino's own logging methods, so `context.runtime` points at the code that called the logger.
 * Every level method, custom levels included, is Pino's function named `LOG`.
 */
export const pinoStackContextHint: StackContextHint = {
  fileName: "node_modules/pino",
  methodNames: ["log", "fatal", "error", "warn", "info", "debug", "trace", "silent", "LOG"],
  required: true,
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

/**
 * Maps a Pino log object to the message, level and fields to log through the Logtail client
 *
 * @param obj - Parsed Pino log line
 * @param levelNames - Level names by number, on top of Pino's defaults
 * @param messageKey - Key Pino stores the message under
 */
export function toLogtailLog(
  obj: { [key: string]: any },
  levelNames: Record<number, string>,
  messageKey: string,
): { message: string; level: ILogLevel; meta: Context } {
  // Logging meta data
  const meta: Context = {};

  // Copy `time` if set: an ISO string, or epoch milliseconds by Pino's default
  if (obj.time !== undefined) {
    const time = new Date(obj.time);
    if (!isNaN(time.valueOf())) {
      meta.dt = time;
    }
  }

  // Carry over any additional data fields
  Object.keys(obj)
    .filter((key) => ["time", messageKey, "message", "level", "v"].indexOf(key) < 0)
    .forEach((key) => (meta[key] = obj[key]));

  // Get message
  // NOTE: Pino passes messages under its messageKey ('msg' by default) but if user passes object to Pino it will
  //       pass it to us even without that field. Later we map it -> 'message' so let's also read 'message' field.
  const message = obj[messageKey] || obj.message;

  // Prevent overriding 'message' with the Pino message
  if (messageKey !== "message" && obj[messageKey] !== undefined && obj.message !== undefined) {
    meta["message_field"] = obj.message;
  }

  return { message, level: getLogLevel(obj.level, levelNames), meta };
}
