import { Duplex, Writable } from "stream";
import { dirname, relative } from "path";

import fetch from "cross-fetch";
import stackTrace, { StackFrame } from 'stack-trace';
// import Msgpack from "msgpack5";

import { ILogtailLog, Context, ILogtailOptions, LogLevel } from "@logtail/types";
import { Base } from "@logtail/core";

// Namespace the msgpack library
// const msgpack = Msgpack();

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
            // "Content-Type": "application/msgpack",
            "Content-Type": "application/json",
            Authorization: `Bearer ${this._accessToken}`,
            "User-Agent": "logtail-js(node)"
          },
          // body: logs.map(log => `${log.level}: ${log.message}`).join("\n")
          // body: msgpack.encode(logsWithSchema).slice()

          // TODO - using JSON for now; switch to msgpack later
          body: JSON.stringify(logs)
        }
      );

      if (res.ok) {
        return logs;
      }

      /**
       * TODO: if status is 50x throw custom ServerError
       * to be used in retry logic
       */
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
    console.log(context);
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
      fileName: this.relativeToMainModule(stackFrame.getFileName()),
      lineNumber: stackFrame.getLineNumber()
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
}
