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
      const { message, level, meta } = toLogtailLog(JSON.parse(line), this.levelNames, this.messageKey);
      void this.logtail.log(message, level, meta, pinoStackContextHint);
    }
    next();
  }

  public _final(callback: (error?: Error | null) => void): void {
    this.logtail.flush().then(() => callback(), callback);
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
