import { Writable } from "stream";

import { Logtail } from "@logtail/node";
import { Context, LogLevel, StackContextHint } from "@logtail/types";

const stackContextHint = {
  fileName: "node_modules/bunyan",
  methodNames: ["fatal", "error", "warn", "info", "debug", "trace"],
};

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
    // NOTE: Bunyan passes messages as log.msg but when it's missing
    //       we can read 'message' field from passed object.
    // WARN: Bunyan ignores 'msg' field in the passed object!
    //       I have messaged Bunyan author here: https://github.com/trentm/node-bunyan/issues/515#issuecomment-1702682901
    Object.keys(log)
      .filter((key) => ["time", "msg", "message", "level", "v"].indexOf(key) < 0)
      .forEach((key) => (meta[key] = log[key]));

    // Get message
    // NOTE: Bunyan passes empty 'msg' when msg is missing
    const use_msg_field = log.msg !== undefined && log.msg.length > 0;
    const msg = (use_msg_field ? log.msg : log.message) || "<no message provided>";

    // Prevent overriding 'message' with 'msg'
    // Save 'message' as 'message_field' if we are using 'msg' as message
    if (use_msg_field && log.message !== undefined) {
      meta.message_field = log.message;
    }

    // Determine the log level
    const level = getLogLevel(log.level);

    // Log to Logtail
    void this._logtail.log(msg, level, meta, stackContextHint as StackContextHint);

    next();
  }
}
