import fetch from "cross-fetch";

import { ILogtailLog, ILogtailOptions } from "@logtail/types";
import { Base } from "@logtail/core";

// Awaiting: https://bugs.chromium.org/p/chromium/issues/detail?id=571722
// import { getUserAgent } from "./helpers";

export class Browser extends Base {
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
            "Content-Type": "application/json",
            Authorization: `Bearer ${this._accessToken}`
            // Awaiting: https://bugs.chromium.org/p/chromium/issues/detail?id=571722
            // "User-Agent": getUserAgent()
          },
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
}
