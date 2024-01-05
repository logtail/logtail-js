import { Duplex, Writable } from "stream";

import fetch from "cross-fetch";
import { encode } from "@msgpack/msgpack";

import { Context, ILogLevel, ILogtailLog, ILogtailOptions, LogLevel, StackContextHint } from "@logtail/types";
import { Base } from "@logtail/core";

import { getStackContext } from "./context";

export class Node extends Base {
  /**
   * Readable/Duplex stream where JSON stringified logs of type `ILogtailLog`
   * will be pushed after syncing
   */
  private _writeStream?: Writable | Duplex;

  public constructor(sourceToken: string, options?: Partial<ILogtailOptions>) {
    super(sourceToken, options);

    // Sync function
    const sync = async (logs: ILogtailLog[]): Promise<ILogtailLog[]> => {
      const res = await fetch(this._options.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/msgpack",
          Authorization: `Bearer ${this._sourceToken}`,
          "User-Agent": "logtail-js(node)",
        },
        body: this.encodeAsMsgpack(logs),
      });

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
   * @param context: (Context) - Log context for passing structured data
   * @param stackContextHint: (StackContextHint|null) - Info about which methods to consider as origin in context.runtime
   * @returns Promise<ILogtailLog> after syncing
   */
  public async log<TContext extends Context>(
    message: string,
    level?: ILogLevel,
    context: TContext = {} as TContext,
    stackContextHint?: StackContextHint,
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
    const encoded = encode(logs);
    const buffer = Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength);
    return buffer;
  }
}
