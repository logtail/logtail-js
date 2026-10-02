import { ILogtailLog } from "@logtail/types";

// Types

/**
 * Buffer time for storing the log, and Promise resolve/reject
 */
export interface IBuffer {
  log: ILogtailLog;
  // Size of the log (in bytes), counted only when there is a max size set
  bytes: number;
  // Settles once the log is sent or dropped
  sent: Promise<ILogtailLog>;
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
 * @param takeAlong - Takes the logs waiting in another batch out of it (its `take()`), to send them along with this
 *                    batch's own logs whenever this batch sends; they are then retried like its own logs.
 */
export default function makeBatch(
  size: number = DEFAULT_BUFFER_SIZE,
  flushTimeout: number = DEFAULT_FLUSH_TIMEOUT,
  retryCount: number = DEFAULT_RETRY_COUNT,
  retryBackoff: number = DEFAULT_RETRY_BACKOFF,
  sizeBytes: number = 0,
  calculateLogSizeBytes: (log: ILogtailLog) => number = calculateJsonLogSizeBytes,
  takeAlong: () => IBuffer[] = () => [],
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
   * Send the buffered logs, and wait until each of them is sent or dropped (not for logs pushed after the call)
   */
  async function flush() {
    const currentBuffer = buffer;
    sendBatches(true);
    await Promise.all(currentBuffer.map((d) => d.sent.catch(() => {})));
  }

  /*
   * Send the buffered logs in batches of at most `size` logs, each ending once it reaches `sizeBytes` like a batch
   * filled by new logs, so that logs of failed sends retried along with newer logs never make a bigger request.
   * A last batch that is not full is sent too when `all` is set, otherwise it stays buffered for the flush timeout.
   */
  function sendBatches(all: boolean) {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = null;

    // Logs taken along from another batch go first, so that they are in a batch sent now
    const currentBuffer = takeAlong().concat(buffer);
    buffer = [];
    bufferSizeBytes = 0;

    let batch: IBuffer[] = [];
    let batchSizeBytes = 0;
    for (const d of currentBuffer) {
      batch.push(d);
      batchSizeBytes += d.bytes;
      if (batch.length >= size || (sizeBytes > 0 && batchSizeBytes >= sizeBytes)) {
        send(batch);
        batch = [];
        batchSizeBytes = 0;
      }
    }

    if (batch.length === 0) {
      return;
    }
    if (all) {
      send(batch);
    } else {
      buffer = batch.concat(buffer);
      bufferSizeBytes += batchSizeBytes;
      setupTimeout();
    }
  }

  /*
   * Send a batch of logs; logs of a failed send go back to the buffer, to be retried with it on the flush timeout
   */
  async function send(batch: IBuffer[]) {
    try {
      await cb(batch.map((d) => d.log));
      sentBatches++;
      batch.forEach((d) => d.resolve(d.log));
    } catch (e) {
      // A log is dropped once it has failed more than `retryCount` times with no batch sent successfully in between,
      // counted per log, so that sends failing at the same time don't use up each other's retries
      const retried: IBuffer[] = [];
      for (const d of batch) {
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
      bufferSizeBytes += retried.reduce((total, d) => total + d.bytes, 0);
      setupTimeout();
    }
  }

  /*
   * Take the logs waiting to be sent out of this batch, for another batch to send and retry along with its own
   */
  function take() {
    const taken = buffer;
    buffer = [];
    bufferSizeBytes = 0;
    return taken;
  }

  /*
   * Start timeout to flush
   */
  function setupTimeout() {
    if (timeout) {
      return;
    }

    timeout = setTimeout(flush, flushTimeout);
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
        let resolve!: IBuffer["resolve"];
        let reject!: IBuffer["reject"];
        const sent = new Promise<ILogtailLog>((res, rej) => {
          resolve = res;
          reject = rej;
        });
        // We can skip log size calculation if there is no max size set
        const bytes = sizeBytes > 0 ? calculateLogSizeBytes(log) : 0;
        buffer.push({ log, bytes, sent, resolve, reject, failures: 0, sentBatches });
        bufferSizeBytes += bytes;

        // If the buffer is full enough, send its full batches
        // Unless we're still waiting for the minimum retry backoff time
        const isBufferFullEnough = buffer.length >= size || (sizeBytes > 0 && bufferSizeBytes >= sizeBytes);
        if (isBufferFullEnough && Date.now() > minRetryBackoff) {
          sendBatches(false);
        } else {
          setupTimeout();
        }

        return sent;
      };
    },
    flush,
    take,
  };
}
