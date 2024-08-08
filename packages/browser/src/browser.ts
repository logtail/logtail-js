import "cross-fetch/polyfill";

import { Context, ILogLevel, ILogtailLog, ILogtailOptions } from "@logtail/types";
import { Base } from "@logtail/core";

// Awaiting: https://bugs.chromium.org/p/chromium/issues/detail?id=571722
// import { getUserAgent } from "./helpers";

export class Browser extends Base {
  public constructor(sourceToken: string, options?: Partial<ILogtailOptions>) {
    // After reaching 48KiB, the batch will get flushed automatically to avoid 64KiB body limit for keepalive requests
    super(sourceToken, { batchSizeKiB: 48, ...options });

    // Sync function
    const sync = async (logs: ILogtailLog[]): Promise<ILogtailLog[]> => {
      const res = await fetch(this._options.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this._sourceToken}`,
          // Awaiting: https://bugs.chromium.org/p/chromium/issues/detail?id=571722
          // "User-Agent": getUserAgent()
        },
        body: JSON.stringify(logs),
        keepalive: true,
      });

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

    this.configureFlushOnPageLeave();
  }

  /**
   * Override `Base` log to add browser-specific context
   *
   * @param message: string - Log message
   * @param level (LogLevel) - Level to log at (debug|info|warn|error)
   * @param context: (Context) - Log context for passing structured data
   * @returns Promise<ILogtailLog> after syncing
   */
  public async log<TContext extends Context>(message: string, level?: ILogLevel, context: TContext = {} as TContext) {
    // Wrap context in an object, if it's not already
    if (typeof context !== "object") {
      const wrappedContext: unknown = { extra: context };
      context = wrappedContext as TContext;
    }
    if (context instanceof Error) {
      const wrappedContext: unknown = { error: context };
      context = wrappedContext as TContext;
    }

    context = { ...this.getCurrentContext(), ...context };

    return super.log(message, level, context);
  }

  protected getCurrentContext(): Context {
    const context: Context = {};

    if (typeof window !== "undefined") {
      context.url = window.location?.href;
      context.device_pixel_ratio = window.devicePixelRatio;
      context.screen_width = window.screen?.width;
      context.screen_height = window.screen?.height;
      context.window_width = window.innerWidth;
      context.window_height = window.innerHeight;
    }
    if (typeof navigator !== "undefined") {
      context.user_locale = (navigator as any).userLanguage || navigator.language;
      context.user_agent = navigator.userAgent;
    }

    return context;
  }

  private configureFlushOnPageLeave(): void {
    if (typeof document === "undefined") {
      return;
    }

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        this.flush();
      }
    });
  }
}
