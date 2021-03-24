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
const DEFAULT_BUFFER_SIZE = 5;

/*
 * Default flush timeout
 */
const DEFAULT_FLUSH_TIMEOUT = 1000;

/**
 * batch the buffer coming in, process them and then resolve
 *
 * @param size - Number
 * @param flushTimeout - Number
 */
export default function makeBatch(
  size: number = DEFAULT_BUFFER_SIZE,
  flushTimeout: number = DEFAULT_FLUSH_TIMEOUT
) {
  let timeout: NodeJS.Timeout | null;
  let cb: Function;
  let buffer: IBuffer[] = [];

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
    } catch (e) {
      currentBuffer.map(d => d.reject(e));
    }
  }

  /*
   * Start timeout to flush
   */
  async function setupTimeout() {
    if (!timeout) {
      timeout = setTimeout(async function() {
        await flush();
      }, flushTimeout);
    }
  }

  /*
   * Batcher which takes a process function
   * @param fn - Any function to process list
   */
  return function(fn: Function) {
    cb = fn;

    /*
     * Pushes each log into list
     * @param log: ILogtailLog - Any object to push into list
     */
    return async function(log: ILogtailLog): Promise<ILogtailLog> {
      return new Promise<ILogtailLog>(async (resolve, reject) => {
        buffer.push({ log, resolve, reject });

        if (buffer.length >= size) {
          await flush();
        } else {
          await setupTimeout();
        }

        return resolve;
      });
    };
  };
}
