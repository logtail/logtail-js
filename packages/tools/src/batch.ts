import { ILogtailLog } from "@logtail/types";

// Types

/**
 * Buffer time for storing the log, and Promise resolve/reject
 */
export interface IBuffer {
  log: ILogtailLog;
  resolve: (log: ILogtailLog | Promise<ILogtailLog>) => void;
  reject: (reason: any) => void;
}

export interface IBatchOptions {
  /**
   * Send logs right away instead of after `flushTimeout`, one send at a time: logs pushed while a send is in progress
   * go in the next send, right after it. Failed sends are still retried after `flushTimeout`.
   */
  sendImmediately?: boolean;
  /**
   * Takes the logs waiting in another batch out of it (its `take()`), to send them along with this batch's own logs
   * whenever this batch sends; they are then retried along with them.
   */
  takeAlong?: () => IBuffer[];
}

/*
 * Default buffer size
 */
const DEFAULT_BUFFER_SIZE = 1000;

/*
 * Default flush timeout
 */
const DEFAULT_FLUSH_TIMEOUT = 1000;

/*
 * Default retry count
 */
const DEFAULT_RETRY_COUNT = 3;

/*
 * Default retry backoff
 */
const DEFAULT_RETRY_BACKOFF = 100;

/*
 * Default function for computing log size (serialized JSON length + 1 for comma)
 */
export const calculateJsonLogSizeBytes = (log: ILogtailLog) => JSON.stringify(log).length + 1;

/**
 * batch the buffer coming in, process them and then resolve
 *
 * @param size - Number
 * @param flushTimeout - Number
 * @param retryCount - Number
 * @param retryBackoff - Number
 * @param sizeBytes - Size of the batch (in bytes) that triggers flushing. Set to 0 to disable.
 * @param calculateLogSizeBytes - Function to calculate size of a single ILogtailLog instance (in bytes).
 * @param options - See `IBatchOptions`
 */
export default function makeBatch(
  size: number = DEFAULT_BUFFER_SIZE,
  flushTimeout: number = DEFAULT_FLUSH_TIMEOUT,
  retryCount: number = DEFAULT_RETRY_COUNT,
  retryBackoff: number = DEFAULT_RETRY_BACKOFF,
  sizeBytes: number = 0,
  calculateLogSizeBytes: (log: ILogtailLog) => number = calculateJsonLogSizeBytes,
  { sendImmediately = false, takeAlong = () => [] }: IBatchOptions = {},
) {
  // Resolves the promise returned by `setupTimeout()`, which waits for the timeout's flush
  let timeoutResolve: (() => void) | null = null;
  let timeout: NodeJS.Timeout | null;
  // When the timeout is due to fire
  let timeoutDue: number = 0;
  let cb: Function;
  let buffer: IBuffer[] = [];
  let bufferSizeBytes = 0;
  let retry: number = 0;
  // Wait until the minimum retry backoff time has passed before retrying
  let minRetryBackoff: number = 0;
  // The send in progress when sending immediately, which sends one batch at a time
  let sending: Promise<void> | null = null;
  /*
   * Flush the list instead of the pending timeout
   */
  async function flush() {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = null;
    // Whoever waits for the timeout's flush (e.g. a flush retrying a failed send) waits for this flush instead
    const resolveTimeout = timeoutResolve;
    timeoutResolve = null;

    try {
      await sendBuffer();
    } finally {
      resolveTimeout?.();
    }
  }

  /*
   * Process then send the list
   */
  async function sendBuffer() {
    // One send at a time when sending immediately: the logs pushed meanwhile go once it is done, right away,
    // or with the retry of its logs if it failed (set up before this resumes)
    if (sending) {
      await sending;
      if (timeout) {
        return;
      }
      return sendBuffer();
    }

    // Nothing buffered, nothing to sync
    if (buffer.length === 0) {
      return;
    }

    // Logs taken along from another batch go first, as they were logged before this batch's own
    const taken = takeAlong();
    const currentBuffer = taken.concat(buffer);
    const currentBufferSizeKB =
      bufferSizeBytes + (sizeBytes > 0 ? taken.reduce((total, d) => total + calculateLogSizeBytes(d.log), 0) : 0);
    buffer = [];
    bufferSizeBytes = 0;

    // A send function throwing right away fails the send like a rejection
    const send = new Promise((resolve) => resolve(cb(currentBuffer.map((d) => d.log))));
    if (sendImmediately) {
      const done = () => {
        sending = null;
      };
      sending = send.then(done, done);
    }

    try {
      await send;
      currentBuffer.forEach((d) => d.resolve(d.log));
      retry = 0;
    } catch (e) {
      if (retry < retryCount) {
        retry++;
        minRetryBackoff = Date.now() + retryBackoff;
        buffer = buffer.concat(currentBuffer);
        bufferSizeBytes += currentBufferSizeKB;
        await setupTimeout();
        return;
      }
      currentBuffer.map((d) => d.reject(e));
      retry = 0;
    }
  }

  /*
   * Start timeout to flush
   */
  async function setupTimeout(delay: number = flushTimeout) {
    if (timeout) {
      return;
    }

    timeoutDue = Date.now() + delay;
    return new Promise<void>((resolve) => {
      // A flush replacing the timeout resolves this too, once it is done
      timeoutResolve = resolve;
      timeout = setTimeout(async function () {
        await flush();
        resolve();
      }, delay);
    });
  }

  /*
   * Batcher which takes a process function
   * @param fn - Any function to process list
   */
  return {
    initPusher: function (fn: Function) {
      cb = fn;

      /*
       * Pushes each log into list
       * @param log: ILogtailLog - Any object to push into list
       */
      return async function (log: ILogtailLog): Promise<ILogtailLog> {
        return new Promise<ILogtailLog>(async (resolve, reject) => {
          buffer.push({ log, resolve, reject });
          // We can skip log size calculation if there is no max size set
          if (sizeBytes > 0) {
            bufferSizeBytes += calculateLogSizeBytes(log);
          }

          // If the buffer is full enough, flush it
          // Unless we're still waiting for the minimum retry backoff time
          const isBufferFullEnough = buffer.length >= size || (sizeBytes > 0 && bufferSizeBytes >= sizeBytes);
          if (isBufferFullEnough && Date.now() > minRetryBackoff) {
            await flush();
          } else {
            // An overdue timeout may have been dropped without firing (Cloudflare Workers drop the timers
            // of a request once it has ended), so set up a new one instead of waiting for it.
            // A timeout that is only late still fires, and its flush clears the new one.
            if (timeout && Date.now() > timeoutDue) {
              timeout = null;
            }
            // Sending immediately sends on the next tick, so that logs pushed in the same tick go in one send
            await setupTimeout(sendImmediately ? 0 : flushTimeout);
          }

          return resolve;
        });
      };
    },
    flush,
    /*
     * Takes the logs waiting to be sent out of this batch, for another batch to send along with its own
     */
    take: function (): IBuffer[] {
      const taken = buffer;
      buffer = [];
      bufferSizeBytes = 0;
      return taken;
    },
  };
}
