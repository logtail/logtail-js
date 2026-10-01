import { ILogtailLog } from "@logtail/types";

// Types

/**
 * Buffer time for storing the log, and Promise resolve/reject
 */
interface IBuffer {
  log: ILogtailLog;
  resolve: (log: ILogtailLog | Promise<ILogtailLog>) => void;
  reject: (reason: any) => void;
  // Failed sends of this log since a batch was last sent successfully
  failures: number;
  // Batches sent successfully when `failures` was last counted
  sentBatches: number;
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
 */
export default function makeBatch(
  size: number = DEFAULT_BUFFER_SIZE,
  flushTimeout: number = DEFAULT_FLUSH_TIMEOUT,
  retryCount: number = DEFAULT_RETRY_COUNT,
  retryBackoff: number = DEFAULT_RETRY_BACKOFF,
  sizeBytes: number = 0,
  calculateLogSizeBytes: (log: ILogtailLog) => number = calculateJsonLogSizeBytes,
) {
  let timeout: NodeJS.Timeout | null;
  let cb: Function;
  let buffer: IBuffer[] = [];
  let bufferSizeBytes = 0;
  // Batches sent successfully so far
  let sentBatches = 0;
  // Wait until the minimum retry backoff time has passed before retrying
  let minRetryBackoff: number = 0;
  /*
   * Process then flush the list
   */
  async function flush() {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = null;

    // Nothing buffered, nothing to sync
    if (buffer.length === 0) {
      return;
    }

    const currentBuffer = buffer;
    buffer = [];
    bufferSizeBytes = 0;

    try {
      await cb(currentBuffer.map((d) => d.log));
      sentBatches++;
      currentBuffer.forEach((d) => d.resolve(d.log));
    } catch (e) {
      // A log is dropped once it has failed more than `retryCount` times with no batch sent successfully in between,
      // counted per log, so that sends failing at the same time don't use up each other's retries
      const retried: IBuffer[] = [];
      for (const d of currentBuffer) {
        if (d.sentBatches !== sentBatches) {
          d.failures = 0;
          d.sentBatches = sentBatches;
        }
        d.failures++;
        if (d.failures > retryCount) {
          d.reject(e);
        } else {
          retried.push(d);
        }
      }

      if (retried.length === 0) {
        return;
      }

      minRetryBackoff = Date.now() + retryBackoff;
      buffer = buffer.concat(retried);
      if (sizeBytes > 0) {
        bufferSizeBytes += retried.reduce((total, d) => total + calculateLogSizeBytes(d.log), 0);
      }
      await setupTimeout();
    }
  }

  /*
   * Start timeout to flush
   */
  async function setupTimeout() {
    if (timeout) {
      return;
    }

    return new Promise<void>((resolve) => {
      timeout = setTimeout(async function () {
        await flush();
        resolve();
      }, flushTimeout);
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
          buffer.push({ log, resolve, reject, failures: 0, sentBatches });
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
            await setupTimeout();
          }

          return resolve;
        });
      };
    },
    flush,
  };
}
