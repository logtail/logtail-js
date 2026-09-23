import { parentPort, workerData } from "worker_threads";
import build from "pino-abstract-transport";

import { Logtail } from "@logtail/node";
import { Context, ILogLevel, ILogtailOptions, StackContextHint } from "@logtail/types";

import { getLogLevel, parseCustomLevels } from "./helpers";

// import { PinoLog, PinoLokiOptionsContract } from './Contracts'
// import { LogPusher } from './LogPusher'

// TODO: stackContextHint =

export interface PinoLog {
  level: number | string;
  [key: string]: any;
}

export interface IPinoLogtailOptions {
  sourceToken: string;
  options: Partial<ILogtailOptions>;

  /**
   * Custom Pino levels, as `{ notice: 35 }` or `"notice:35,critical:55"`, sent to Better Stack under their names.
   * Pino 8.21 and newer share their levels with the transport on their own; the option is for older versions,
   * or to use other names than Pino does.
   */
  customLevels?: Record<string, number> | string;
}

/**
 * Configuration Pino 8.21+ posts to the transport worker right after the logger is created
 */
interface IPinoConfig {
  levels?: { labels: Record<number, string>; values: Record<string, number> };
  messageKey?: string;
}

// How long the transport waits for Pino's configuration when it starts
const PINO_CONFIG_WAIT_MS = 100;

const stackContextHint = {
  fileName: "node_modules/pino",
  methodNames: ["log", "fatal", "error", "warn", "info", "debug", "trace", "silent"],
  required: true,
};

/**
 * Resolves with the configuration Pino posts to the worker, or with null when this Pino does not post one
 */
function receivePinoConfig(): Promise<IPinoConfig | null> {
  if (!parentPort || workerData?.workerData?.pinoWillSendConfig !== true) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const handleMessage = (message: { code?: string; config?: IPinoConfig }) => {
      if (message?.code === "PINO_CONFIG") {
        parentPort!.off("message", handleMessage);
        resolve(message.config ?? null);
      }
    };
    parentPort!.on("message", handleMessage);
  });
}

export async function logtailTransport(options: IPinoLogtailOptions) {
  const logtail = new Logtail(options.sourceToken, options.options);
  const customLevels = parseCustomLevels(options.customLevels);
  let levelNames = customLevels;
  let messageKey = "msg";

  // In the usual `pino(pino.transport(...))` flow Pino's configuration is already queued when the worker
  // starts, so the wait is only noticeable when Pino sends none, e.g. with pino.multistream
  const configReceived = receivePinoConfig().then((config) => {
    if (config?.levels) {
      levelNames = { ...config.levels.labels, ...customLevels };
    }
    if (config?.messageKey) {
      messageKey = config.messageKey;
    }
  });
  await Promise.race([configReceived, new Promise((resolve) => setTimeout(resolve, PINO_CONFIG_WAIT_MS))]);

  const buildFunc = async (source: any) => {
    for await (let obj of source) {
      // Logging meta data
      const meta: Context = {};

      // Copy `time` if set
      if (typeof obj.time === "string" || obj.time.length) {
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
      const msg = obj[messageKey] || obj.message;

      // Prevent overriding 'message' with the Pino message
      if (messageKey !== "message" && obj[messageKey] !== undefined && obj.message !== undefined) {
        meta["message_field"] = obj.message;
      }

      // Determine the log level
      let level: ILogLevel;

      try {
        level = getLogLevel(obj.level, levelNames);
      } catch (_) {
        console.error("Error while mapping log level.");
        continue;
      }

      // Log to Logtail
      logtail.log(msg, level, meta, stackContextHint as StackContextHint);
    }
  };
  const closeFunc = async () => {
    return await logtail.flush();
  };
  return build(buildFunc, { close: closeFunc });
}
