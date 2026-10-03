import { parentPort, workerData } from "worker_threads";
import build from "pino-abstract-transport";

import { Logtail } from "@logtail/node";
import { ILogtailOptions } from "@logtail/types";

import { IPinoConfig, parseCustomLevels, pinoStackContextHint, toLogtailLog } from "./helpers";

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

// How long the transport waits for Pino's configuration when it starts
const PINO_CONFIG_WAIT_MS = 100;

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
    for await (const obj of source) {
      const { message, level, meta } = toLogtailLog(obj, levelNames, messageKey);
      logtail.log(message, level, meta, pinoStackContextHint);
    }
  };
  const closeFunc = async () => {
    return await logtail.flush();
  };
  return build(buildFunc, { close: closeFunc });
}
