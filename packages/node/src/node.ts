import { Duplex, Writable } from "stream";
import { encode } from "@msgpack/msgpack";
import http from "node:http";
import https from "node:https";
import zlib from "node:zlib";

import { Context, ILogLevel, ILogtailLog, ILogtailNodeOptions, LogLevel, StackContextHint } from "@logtail/types";
import { Base } from "@logtail/core";

import { getStackContext } from "./context";

export class Node extends Base {
  /**
   * Readable/Duplex stream where JSON stringified logs of type `ILogtailLog`
   * will be pushed after syncing
   */
  private _writeStream?: Writable | Duplex;

  public constructor(sourceToken: string, options?: Partial<ILogtailNodeOptions>) {
    options = {
      timeout: 30000, // 30 seconds default timeout
      ...options,
    };
    super(sourceToken, options);

    const agent = this.createAgent();

    // Sync function
    const sync = async (logs: ILogtailLog[]): Promise<ILogtailLog[]> => {
      const nodeOptions = this._options as ILogtailNodeOptions;
      const request = this.getHttpModule().request(nodeOptions.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/msgpack",
          "Content-Encoding": "gzip",
          Authorization: `Bearer ${this._sourceToken}`,
          "User-Agent": "logtail-js(node)",
        },
        agent,
        timeout: nodeOptions.timeout > 0 ? nodeOptions.timeout : undefined,
      });

      const response: http.IncomingMessage = await new Promise((resolve, reject) => {
        // Setup timeout handler if timeout is configured
        if (nodeOptions.timeout > 0) {
          request.on("timeout", () => {
            request.destroy();
            reject(new Error(`Request timeout after ${nodeOptions.timeout}ms`));
          });
        }
        request.on("response", resolve);
        request.on("error", reject);

        // Compress the logs using gzip
        zlib.gzip(this.encodeAsMsgpack(logs), (err, compressedData) => {
          if (err) {
            reject(err);
            return;
          }
          request.write(compressedData);
          request.end();
        });
      });

      if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
        return logs;
      }

      throw new Error(response.statusMessage);
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

  private createAgent() {
    const nodeOptions = this._options as ILogtailNodeOptions;
    const family = nodeOptions.useIPv6 ? 6 : 4;
    return new (this.getHttpModule().Agent)({
      family,
    });
  }

  private getHttpModule(): typeof http | typeof https {
    return this._options.endpoint.startsWith("https") ? https : http;
  }
}
