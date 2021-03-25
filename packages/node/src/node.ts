import { Duplex, Writable } from "stream";
import { dirname, relative } from "path";

import fetch from "cross-fetch";
import stackTrace, { StackFrame } from 'stack-trace';
import { encode } from "@msgpack/msgpack";

import { ILogtailLog, Context, ILogtailOptions, LogLevel } from "@logtail/types";
import { Base } from "@logtail/core";

export class Node extends Base {
  /**
   * Readable/Duplex stream where JSON stringified logs of type `ILogtailLog`
   * will be pushed after syncing
   */
  private _writeStream?: Writable | Duplex;

  public constructor(
    accessToken: string,
    options?: Partial<ILogtailOptions>
  ) {
    super(accessToken, options);

    // Sync function
    const sync = async (logs: ILogtailLog[]): Promise<ILogtailLog[]> => {
      const res = await fetch(
        this._options.endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/msgpack",
            Authorization: `Bearer ${this._accessToken}`,
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
    context: TContext = {} as TContext
  ) {
    // Process/sync the log, per `Base` logic
    context = { ...this.getStackContext(), ...context };
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

  /**
   * Determines the file name and the line number from which the log
   * was initiated (if we're able to tell).
   *
   * @returns Context The caller's filename and the line number
   */
  private getStackContext(): Context {
    const stackFrame = this.getCallingFrame();
    if (stackFrame === null) return {};

    return {
      context: {
        runtime: {
          file: this.relativeToMainModule(stackFrame.getFileName()),
          type: stackFrame.getTypeName(),
          method: stackFrame.getMethodName(),
          function: stackFrame.getFunctionName(),
          line: stackFrame.getLineNumber(),
          column: stackFrame.getColumnNumber(),
        },
        system: {
          pid: process.pid,
          main_file: require.main?.filename ?? ''
        }
      }
    };
  }

  private getCallingFrame(): StackFrame | null {
    const stack = stackTrace.get();
    if (stack === null) return null;

    const logtailTypeName = stack[0].getTypeName();
    for (let frame of stack) {
      if (frame.getTypeName() !== logtailTypeName) return frame;
    }

    return null;
  }

  private relativeToMainModule(fileName: string): string {
    const rootPath = dirname(require.main?.filename ?? "");
    return relative(rootPath, fileName);
  }

  private encodeAsMsgpack(logs: ILogtailLog[]): Buffer {
    const logsWithISODateFormat = logs.map((log) => ({ ...log, dt: log.dt.toISOString() }));
    const encoded = encode(logsWithISODateFormat);
    const buffer = Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength)
    return buffer;
  }
}
