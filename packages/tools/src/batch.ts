import { ILogtailLog } from "@logtail/types";

// Types

/**
 * Buffer time for storing the log, and Promise resolve/reject
 */
interface IBuffer {
  log: ILogtailLog;
  resolve: (log: ILogtailLog | Promise<ILogtailLog>) => void;
  reject: (reason: any) => void;
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

/**
 * batch the buffer coming in, process them and then resolve
 *
 * @param size - Number
 * @param flushTimeout - Number
 * @param retryCount - Number
 * @param retryBackoff - Number
 */
export default function makeBatch(
  size: number = DEFAULT_BUFFER_SIZE,
  flushTimeout: number = DEFAULT_FLUSH_TIMEOUT,
  retryCount: number = DEFAULT_RETRY_COUNT,
  retryBackoff: number = DEFAULT_RETRY_BACKOFF,
) {
  let timeout: NodeJS.Timeout | null;
  let cb: Function;
  let buffer: IBuffer[] = [];
  let retry: number = 0;
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

    const currentBuffer = buffer;
    buffer = [];

    try {
      await cb(currentBuffer.map(d => d.log));
      currentBuffer.forEach(d => d.resolve(d.log));
      retry = 0;
    } catch (e) {
      if (retry < retryCount) {
        retry++;
        minRetryBackoff = Date.now() + retryBackoff;
        buffer = buffer.concat(currentBuffer);
        await setupTimeout();
        return;
      }
      currentBuffer.map(d => d.reject(e));
      retry = 0;
    }
  }

  /*
   * Start timeout to flush
   */
  async function setupTimeout() {
    if (timeout) {
      return;
    }

    return new Promise<void>(resolve => {
      timeout = setTimeout(async function() {
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
    initPusher: function(fn: Function) {
      cb = fn;

      /*
       * Pushes each log into list
       * @param log: ILogtailLog - Any object to push into list
       */
      return async function(log: ILogtailLog): Promise<ILogtailLog> {
        return new Promise<ILogtailLog>(async (resolve, reject) => {
          buffer.push({ log, resolve, reject });

          // If the buffer is full enough, flush it
          // Unless we're still waiting for the minimum retry backoff time
          if (buffer.length >= size && Date.now() > minRetryBackoff) {
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
