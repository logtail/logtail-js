import { Writable } from "stream";

import { Logtail } from "@logtail/node";

import { IPinoConfig, parseCustomLevels, pinoStackContextHint, toLogtailLog } from "./helpers";

export interface ILogtailStreamOptions {
  /**
   * Custom Pino levels, as `{ notice: 35 }` or `"notice:35,critical:55"`, sent to Better Stack under their names.
   * Pino 8.21 and newer share their levels with the stream on their own; the option is for older versions,
   * or to use other names than Pino does.
   */
  customLevels?: Record<string, number> | string;
}

/**
 * In-process Pino destination that logs through a Logtail client the application owns, for environments
 * where a transport worker cannot be waited for, such as serverless functions: `await logtail.flush()`
 * before the handler returns and everything logged so far has been sent.
 */
export class LogtailStream extends Writable {
  private readonly logtail: Logtail;

  private readonly customLevels: Record<number, string>;

  private levelNames: Record<number, string>;

  private messageKey = "msg";

  public constructor(logtail: Logtail, options: ILogtailStreamOptions = {}) {
    super();
    this.logtail = logtail;
    this.customLevels = parseCustomLevels(options.customLevels);
    this.levelNames = this.customLevels;

    // Pino 8.21+ emits its levels and message key on the destination right after the logger is created
    this.on("message", (message: { code?: string; config?: IPinoConfig }) => {
      if (message?.code === "PINO_CONFIG" && message.config) {
        this.applyConfig(message.config);
      }
    });
  }

  public _write(chunk: Buffer | string, _encoding: BufferEncoding, next: (error?: Error | null) => void): void {
    for (const line of chunk.toString().split("\n")) {
      if (line === "") {
        continue;
      }

      let obj;
      try {
        obj = JSON.parse(line);
      } catch (_) {
        // Not a Pino log line, e.g. text other code wrote to the stream or a cut-off line: skipped, like the worker
        // transport does
        continue;
      }

      const { message, level, meta } = toLogtailLog(obj, this.levelNames, this.messageKey);
      // A failed send is counted in `logtail.dropped` and printed by the client unless `throwExceptions` or
      // `ignoreExceptions` is set. There is no caller to throw to, so the rejection `throwExceptions` causes is
      // ignored: printing it with console.error would log it again when `replaceConsoleMethods()` forwards the console.
      this.logtail.log(message, level, meta, pinoStackContextHint).catch(() => {});
    }
    next();
  }

  /**
   * Called by `logger.flush()`: flushes the Logtail client
   */
  public flush(callback: (error?: Error) => void): void {
    this.logtail.flush().then(() => callback(), callback);
  }

  public _final(callback: (error?: Error | null) => void): void {
    this.flush(callback);
  }

  private applyConfig(config: IPinoConfig): void {
    if (config.levels) {
      this.levelNames = { ...config.levels.labels, ...this.customLevels };
    }
    if (config.messageKey) {
      this.messageKey = config.messageKey;
    }
  }
}
