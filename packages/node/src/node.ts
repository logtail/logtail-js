import { Duplex, Writable } from "stream";

import fetch from "cross-fetch";
import { encode } from "@msgpack/msgpack";

import { ILogtailLog, Context, StackContextHint, ILogtailOptions, LogLevel } from "@logtail/types";
import { Base } from "@logtail/core";

import { getStackContext } from "./context";

export class Node extends Base {
  /**
   * Readable/Duplex stream where JSON stringified logs of type `ILogtailLog`
   * will be pushed after syncing
   */
  private _writeStream?: Writable | Duplex;

  public constructor(
    sourceToken: string,
    options?: Partial<ILogtailOptions>
  ) {
    super(sourceToken, options);

    // Sync function
    const sync = async (logs: ILogtailLog[]): Promise<ILogtailLog[]> => {
      const res = await fetch(
        this._options.endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/msgpack",
            Authorization: `Bearer ${this._sourceToken}`,
            "User-Agent": "logtail-js(node)"
          },
          body: this.encodeAsMsgpack(logs)
        }
      );

      if (res.ok) {
        return logs;
      }

      throw new Error(res.statusText);
    };

    // Set the throttled sync function
    this.setSync(sync);
  }

  /**
   * Override `Base` log to enable Node.js streaming
   *
   * @param message: string - Log message
   * @param level (LogLevel) - Level to log at (debug|info|warn|error)
   * @param log: (Partial<ILogtailLog>) - Initial log (optional)
   * @returns Promise<ILogtailLog> after syncing
   */
  public async log<TContext extends Context>(
    message: string,
    level?: LogLevel,
    context: TContext = {} as TContext,
    stackContextHint?: StackContextHint
  ) {
    // Process/sync the log, per `Base` logic
    context = { ...getStackContext(this, stackContextHint), ...context };
    const processedLog = await super.log(message, level, context);

    // Push the processed log to the stream, for piping
    if (this._writeStream) {
      this._writeStream.write(JSON.stringify(processedLog) + "\n");
    }

    // Return the transformed log
    return processedLog as ILogtailLog & TContext;
  }

  /**
   * Pipe JSON stringified `ILogtailLog` to a stream after syncing
   *
   * @param stream - Writable|Duplex stream
   */
  public pipe(stream: Writable | Duplex) {
    this._writeStream = stream;
    return stream;
  }

  private encodeAsMsgpack(logs: ILogtailLog[]): Buffer {
    const logsWithISODateFormat = logs.map((log) => ({ ...this.sanitizeForEncoding(log), dt: log.dt.toISOString() }));
    const encoded = encode(logsWithISODateFormat);
    const buffer = Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength)
    return buffer;
  }

  private sanitizeForEncoding(value: any): any {
    if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
      return value;
    } else if (value instanceof Date) {
      return value.toISOString();
    } else if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeForEncoding(item));
    } else if (typeof value === "object") {
      const logClone: { [key: string]: any } = {};

      Object.entries(value).forEach(item => {
        const key = item[0];
        const value = item[1];

        const result = this.sanitizeForEncoding(value);
        if (result !== undefined){
          logClone[key] = result;
        }
      });

      return logClone;
    } else {
      return undefined;
    }
  }
}
