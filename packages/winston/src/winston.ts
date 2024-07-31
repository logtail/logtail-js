import { LogEntry } from "winston";
import Transport from "winston-transport";

import { Logtail } from "@logtail/node";
import { LogLevel, StackContextHint } from "@logtail/types";

const stackContextHint = {
  fileName: "node_modules/winston",
  methodNames: ["log", "error", "warn", "info", "http", "verbose", "debug", "silly"],
};

export class LogtailTransport extends Transport {
  public constructor(
    private _logtail: Logtail,
    opts?: Transport.TransportStreamOptions,
  ) {
    super({
      ...opts,
      close: () => {
        this._logtail.flush().then(() => {
          if (opts?.close) {
            opts.close();
          }
        });
      },
    });
  }

  public log(info: LogEntry, cb: Function) {
    // Pass the log to Winston's internal event handlers
    setImmediate(() => {
      this.emit("logged", info);
    });

    const { level, message, ...meta } = info;

    // Determine the log level

    // Log out to Logtail
    void this._logtail.log(message, level, meta, stackContextHint as StackContextHint);

    // Winston callback...
    cb();
  }
}
