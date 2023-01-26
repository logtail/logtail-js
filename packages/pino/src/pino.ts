import build from 'pino-abstract-transport'

import { Logtail } from "@logtail/node";
import { Context, LogLevel, ILogtailOptions, StackContextHint } from "@logtail/types";

import { getLogLevel } from "./helpers";

// import { PinoLog, PinoLokiOptionsContract } from './Contracts'
// import { LogPusher } from './LogPusher'

// TODO: stackContextHint =

export interface PinoLog {
  level: number
  [key: string]: any
}

export interface IPinoLogtailOptions {
  sourceToken: string,
  options: Partial<ILogtailOptions>
}

export async function logtailTransport(options: IPinoLogtailOptions) {
  // FIXME: error handling for no source token 
  const logtail = new Logtail(options.sourceToken)

  return build(async (source: any) => {
    for await (let obj of source) {
      // Log should have string `msg` key, > 0 length
      if (typeof obj.msg !== "string" || !obj.msg.length) {
        console.error('Field "msg" has to be a non-empty string.')
        continue
      }

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
        .filter(key => ["time", "msg", "level", "v"].indexOf(key) < 0)
        .forEach(key => (meta[key] = obj[key]));

      // Determine the log level
      let level: LogLevel;

      try {
        level = getLogLevel(obj.level);
      } catch (_) {
        console.error('Error while mapping log level.')
        continue
      }

      // Log to Logtail
      logtail.log(obj.msg, level, meta);
    }
  })
}
