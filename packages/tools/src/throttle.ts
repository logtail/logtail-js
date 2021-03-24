import Queue from "./queue";
import { InferArgs } from "./types";

/**
 * Create a throttle which runs up to `max` async functions at once
 * @param max - maximum number of async functions to run
 */
export default function makeThrottle<T extends (...args: any[]) => any>(
  max: number
) {
  // Current iteration cycle
  let current = 0;

  // Create a FIFO queue
  const queue = new Queue<() => Promise<void>>();

  /**
   * Throttle function that throttles the passed func according to `max`
   * @param fn - async function to resolve
   */
  function throttle(fn: T) {
    return async (...args: InferArgs<T>[]) => {
      return new Promise<InferArgs<T>>((resolve, reject) => {
        /**
         * Handler for resolving the Promise chain
         */
        async function handler() {
          // Only resolve if the `max` hasn't been exhausted
          if (current < max) {
            // Increment the available slot size
            current++;

            try {
              // Await the passed function here first, to determine if any
              // errors are thrown, so they can be handled by our outside `reject`
              resolve(await fn(...args));
            } catch (e) {
              reject(e);
            }

            // Since this has now resolved, make the slot available again
            current--;

            // If there are items waiting in the queue, resolve the next
            // Promise
            if (queue.length > 0) {
              queue.shift()!();
            }
          } else {
            // The `max` has been exceeded - push onto the queue to wait
            queue.push(handler);
          }
        }

        // Return the async handler
        return handler();
      });
    };
  }

  // Return the throttle function
  return throttle;
}
