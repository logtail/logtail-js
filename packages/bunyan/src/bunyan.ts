import { Writable } from "stream";

import { Logtail } from "@logtail/node";
import {Context, LogLevel, StackContextHint} from "@logtail/types";

const stackContextHint = { fileName: "node_modules/bunyan", methodNames: [ "fatal", "error", "warn", "info", "debug", "trace" ] };

import { getLogLevel } from "./helpers";

export class LogtailStream extends Writable {
  public constructor(private _logtail: Logtail) {
    super();
  }

  public _write(chunk: any, encoding: any, next: any) {
    // Sanity check for the format of the log
    const jsonString = chunk.toString();

    let log: any;

    // Should be JSON parsable
    try {
      log = JSON.parse(jsonString);
    } catch (e) {
      return next(e);
    }

    // Log should have string `msg` key, > 0 length
    if (typeof log.msg !== "string" || !log.msg.length) {
      return next();
    }

    // Logging meta data
    const meta: Context = {};

    // Copy `time` if set
    if (typeof log.time === "string" || log.time.length) {
      const time = new Date(log.time);
      if (!isNaN(time.valueOf())) {
        meta.dt = time;
      }
    }

    // Carry over any additional data fields
    Object.keys(log)
      .filter(key => ["time", "msg", "level", "v"].indexOf(key) < 0)
      .forEach(key => (meta[key] = log[key]));

    // Determine the log level
    let level: LogLevel;

    try {
      level = getLogLevel(log.level);
    } catch (_) {
      return next();
    }

    // Log to Logtail
    void this._logtail.log(log.msg, level, meta, stackContextHint as StackContextHint);

    next();
  }
}
