import { Duplex, Writable } from "stream";

import fetch from "cross-fetch";
import { encode } from "@msgpack/msgpack";

import {
  Context,
  ILogLevel,
  ILogtailLog,
  ILogtailOptions,
  LogLevel,
  StackContextHint,
} from "@logtail/types";
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
   * @returns Promise<ILogtailLog> after syncing
   */
  public async log<TContext extends Context>(
    message: string,
    level?: ILogLevel,
    context: TContext = {} as TContext,
    stackContextHint?: StackContextHint,
  ) {
    // Wrap context in an object, if it's not already
    if (typeof context !== "object") {
      const wrappedContext: unknown = { extra: context };
      context = wrappedContext as TContext;
    }
    if (context instanceof Error) {
      const wrappedContext: unknown = { error: context };
      context = wrappedContext as TContext;
    }

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
    const maxDepth = this._options.contextObjectMaxDepth;
    const logsWithISODateFormat = logs.map(log => ({
      ...this.sanitizeForEncoding(log, maxDepth),
      dt: log.dt.toISOString(),
    }));
    const encoded = encode(logsWithISODateFormat);
    const buffer = Buffer.from(
      encoded.buffer,
      encoded.byteOffset,
      encoded.byteLength,
    );
    return buffer;
  }

  private sanitizeForEncoding(
    value: any,
    maxDepth: number,
    visitedObjects: WeakSet<any> = new WeakSet(),
  ): any {
    if (
      value === null ||
      typeof value === "boolean" ||
      typeof value === "number" ||
      typeof value === "string"
    ) {
      return value;
    } else if (value instanceof Date) {
      // Date instances can be invalid & toISOString() will fail
      if (isNaN(value.getTime())) {
        return value.toString();
      }

      return value.toISOString();
    } else if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack?.split("\n"),
      };
    } else if (
      (typeof value === "object" || Array.isArray(value)) &&
      (maxDepth < 1 || visitedObjects.has(value))
    ) {
      if (visitedObjects.has(value)) {
        if (this._options.contextObjectCircularRefWarn) {
          console.warn(
            `[Logtail] Found a circular reference when serializing logs. Please do not use circular references in your logs.`,
          );
        }
        return "<omitted circular reference>";
      }
      if (this._options.contextObjectMaxDepthWarn) {
        console.warn(
          `[Logtail] Max depth of ${this._options.contextObjectMaxDepth} reached when serializing logs. Please do not use excessive object depth in your logs.`,
        );
      }
      return `<omitted context beyond configured max depth: ${this._options.contextObjectMaxDepth}>`;
    } else if (Array.isArray(value)) {
      visitedObjects.add(value);
      const sanitizedArray = value.map(item =>
        this.sanitizeForEncoding(item, maxDepth - 1, visitedObjects),
      );
      visitedObjects.delete(value);

      return sanitizedArray;
    } else if (typeof value === "object") {
      const logClone: { [key: string]: any } = {};

      visitedObjects.add(value);

      Object.entries(value).forEach(item => {
        const key = item[0];
        const value = item[1];

        const result = this.sanitizeForEncoding(
          value,
          maxDepth - 1,
          visitedObjects,
        );
        if (result !== undefined) {
          logClone[key] = result;
        }
      });

      visitedObjects.delete(value);

      return logClone;
    } else if (typeof value === "undefined") {
      return undefined;
    } else {
      return `<omitted unserializable ${typeof value}>`;
    }
  }
}
