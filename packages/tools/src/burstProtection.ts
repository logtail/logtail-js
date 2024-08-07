import { InferArgs } from "./types";

const RESOLUTION = 64;

/**
 * Create a burst protection which allows running function only a number of times in a configurable window
 * @param milliseconds - length of the checked window in milliseconds
 * @param max - maximum number of functions to run in that window
 * @param functionName - function name for error message
 */
export default function makeBurstProtection<T extends (...args: any[]) => any>(
  milliseconds: number,
  max: number,
  functionName: string = "The function",
) {
  if (milliseconds <= 0 || max <= 0) {
    return (fn: T) => fn;
  }

  let callCounts: number[] = [0];
  let lastErrorOutput: number = 0;
  let lastIntervalTime: number = Date.now();

  function updateCallCounts() {
    const now = Date.now();
    const intervalLength = milliseconds / RESOLUTION;

    if (now < lastIntervalTime + intervalLength) {
      return;
    }

    // Prepend callCounts with correct number of zeroes and keep its length to RESOLUTION at max
    const intervalCountSinceLast = Math.floor((now - lastIntervalTime) / intervalLength);
    callCounts = Array(Math.min(intervalCountSinceLast, RESOLUTION)).fill(0).concat(callCounts).slice(0, RESOLUTION);
    lastIntervalTime += intervalCountSinceLast * intervalLength;
  }

  function getTotalCallCount() {
    return callCounts.reduce((total, item) => total + item);
  }

  function incrementCallCount() {
    callCounts[0]++;
  }

  return (fn: T) => {
    return async (...args: InferArgs<T>[]) => {
      updateCallCounts();
      if (getTotalCallCount() < max) {
        incrementCallCount();
        return await fn(...args);
      }

      const now = Date.now();
      if (lastErrorOutput < now - milliseconds) {
        lastErrorOutput = now;
        console.error(`${functionName} was called more than ${max} times during last ${milliseconds}ms. Ignoring.`);
      }
    };
  };
}
