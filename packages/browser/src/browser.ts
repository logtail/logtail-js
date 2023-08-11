import fetch from "cross-fetch";

import {Context, ILogLevel, ILogtailLog, ILogtailOptions, StackContextHint} from "@logtail/types";
import { Base } from "@logtail/core";
import { sanitizeContext } from "@logtail/tools";

// Awaiting: https://bugs.chromium.org/p/chromium/issues/detail?id=571722
// import { getUserAgent } from "./helpers";

export class Browser extends Base {
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
            "Content-Type": "application/json",
            Authorization: `Bearer ${this._sourceToken}`
            // Awaiting: https://bugs.chromium.org/p/chromium/issues/detail?id=571722
            // "User-Agent": getUserAgent()
          },
          body: JSON.stringify(logs.map(log => sanitizeContext(log, this._options)))
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
   * Override `Base` log to wrap context
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
  ) {
    // Wrap context in an object, if it's not already
    if (typeof context !== 'object') {
      const wrappedContext: unknown = { extra: context };
      context = wrappedContext as TContext;
    }
    if (context instanceof Error) {
      const wrappedContext: unknown = { error: context };
      context = wrappedContext as TContext;
    }

    return super.log(message, level, context);
  }
}
