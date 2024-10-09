import build from "pino-abstract-transport";

import { Logtail } from "@logtail/node";
import { Context, LogLevel, ILogtailOptions, StackContextHint } from "@logtail/types";

import { getLogLevel } from "./helpers";

// import { PinoLog, PinoLokiOptionsContract } from './Contracts'
// import { LogPusher } from './LogPusher'

// TODO: stackContextHint =

export interface PinoLog {
  level: number;
  [key: string]: any;
}

export interface IPinoLogtailOptions {
  sourceToken: string;
  options: Partial<ILogtailOptions>;
}

const stackContextHint = {
  fileName: "node_modules/pino",
  methodNames: ["log", "fatal", "error", "warn", "info", "debug", "trace", "silent"],
  required: true,
};

export async function logtailTransport(options: IPinoLogtailOptions) {
  const logtail = new Logtail(options.sourceToken, options.options);

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
        .filter((key) => ["time", "msg", "message", "level", "v"].indexOf(key) < 0)
        .forEach((key) => (meta[key] = obj[key]));

      // Get message
      // NOTE: Pino passes messages as obj.msg but if user passes object to Pino it will pass it to us
      //       even without 'msg' field. Later we map 'msg' -> 'message' so let's also read 'message' field.
      const msg = obj.msg || obj.message;

      // Prevent overriding 'message' with 'msg'
      if (obj.msg !== undefined && obj.message !== undefined) {
        meta["message_field"] = obj.message;
      }

      // Determine the log level
      let level: LogLevel;

      try {
        level = getLogLevel(obj.level);
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
