import 'cross-fetch/polyfill';

import { ILogtailLog, ILogtailOptions } from "@logtail/types";
import { Base } from "@logtail/core";

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
          body: JSON.stringify(logs),
          keepalive: true,
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

    this.configureFlushOnPageLeave();
  }

  private configureFlushOnPageLeave() {
    if (typeof document === 'undefined') {
      return;
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush();
      }
    });
  }
}
