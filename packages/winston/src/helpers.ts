import {LogLevel} from "@logtail/types";

/**
 * Return a Logtail `LogLevel` based on the Winston level
 * @param level string - Winston log level
 */
export function getLogLevel(level: string): LogLevel {
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

        // Info
        case "info":
            return LogLevel.Info;

        // Http
        case "http":
            return LogLevel.Http;

        // Verbose
        case "verbose":
            return LogLevel.Verbose;

        // Debug
        case "debug":
            return LogLevel.Debug;

        // Silly
        case "silly":
            return LogLevel.Silly;

        // Trace
        case "trace":
            return LogLevel.Trace;
    }
    // By default, return info
    return LogLevel.Info;
}
