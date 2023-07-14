import { InferArgs } from "./types";

const RESOLUTION = 100;

/**
 * Create a burst protection which allows running function only a number of times in a configurable window
 * @param milliseconds - length of the checked window in milliseconds
 * @param max - maximum number of functions to run in that window
 * @param functionName - function name for error message
 */
export default function makeBurstProtection<T extends (...args: any[]) => any>(
  milliseconds: number,
  max: number,
  functionName: string = 'The function',
) {
  if (milliseconds <= 0 || max <= 0) {
    return (fn: T) => fn
  }

  let callCounts: number[] = [0];
  let lastErrorOutput: number = 0;

  setInterval(() => {
    callCounts = callCounts.slice(0, RESOLUTION - 1)
    callCounts.unshift(0)
  }, milliseconds / RESOLUTION)

  function getTotalCallCount() {
    return callCounts.reduce((total, item) => total + item);
  }

  function incrementCallCount() {
    callCounts[0]++
  }

  return (fn: T) => {
    return async (...args: InferArgs<T>[]) => {
      if (getTotalCallCount() < max) {
        incrementCallCount();
        return await fn(...args)
      }

      const now = Date.now()
      if (lastErrorOutput < now - milliseconds) {
        lastErrorOutput = now
        console.error(`${functionName} was called more than ${max} times during last ${milliseconds}ms. Ignoring.`)
      }
    };
  };
}
