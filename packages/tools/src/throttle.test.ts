import makeThrottle from "./throttle";

// Sample log type
interface ILog {
  message: string;
}

// Sample pipeline type
type Pipeline = (log: ILog) => Promise<ILog>;

describe("Throttle tests", () => {
  it("should throttle Promises", async () => {
    // Fixtures
    const max = 2;
    const throttleTime = 20; // ms
    const numberOfPromises = 10;

    // Create the throttle function
    const throttle = makeThrottle<Pipeline>(max);

    // Create the pipeline function to use the throttle
    const pipeline = throttle(
      async (log) =>
        new Promise<ILog>((resolve) => {
          setTimeout(() => {
            resolve(log);
          }, throttleTime);
        }),
    );

    // Build the promises
    const promises = [];

    // Start the timer
    const start = process.hrtime();

    for (let i = 0; i < numberOfPromises; i++) {
      promises.push(pipeline({ message: "Hey" }));
    }

    // Await until they've all finished
    await Promise.all(promises);

    // End the timer
    const end = process.hrtime(start)[1] / 1000000;

    // Expect time to have taken (numberOfPromises / max) * throttleTime
    const expectedTime = (numberOfPromises / max) * throttleTime;
    const toleranceMilliseconds = 0.2;

    expect(end).toBeGreaterThanOrEqual(expectedTime - toleranceMilliseconds);
  });

  it("should handle rejections", async () => {
    // Fixtures
    const numberOfPromises = 10;

    // Create the throttle function
    const throttle = makeThrottle(5);

    // Error counter
    let errors = 0;

    // Create a throttled function that will throw half the time
    const pipeline = throttle(async (i) => {
      if (i % 2 == 0) {
        throw new Error("Thrown inside throttled function!");
      }
      return i;
    });

    for (let i = 0; i < numberOfPromises; i++) {
      await pipeline(i).catch(() => errors++);
    }

    expect(errors).toEqual(numberOfPromises / 2);
  });

  it("should drop requests when queue limit is exceeded", async () => {
    let functionCallCount = 0;

    // Create a function that takes some time to complete
    const slowFunction = async (id: number) => {
      functionCallCount++;
      await new Promise((resolve) => setTimeout(resolve, 100));
      return `result ${id}`;
    };

    // Create throttle with max=1 (1 concurrent), queueMax=2 (2 queued)
    const throttle = makeThrottle(1, 2);

    const throttledFunction = throttle(slowFunction);

    // Call 5 times quickly
    const promises = [];
    for (let i = 1; i <= 5; i++) {
      promises.push(
        throttledFunction(i).catch((err) => {
          if (err.message === "Queue max limit exceeded") {
            return `dropped ${i}`;
          }
          throw err;
        }),
      );
    }

    // Wait for all promises to settle
    const results = await Promise.all(promises);

    // Verify results
    expect(functionCallCount).toBe(3); // 1 immediate + 2 queued = 3 total executed

    // Check that we got the expected mix of results and drops
    expect(results).toStrictEqual(["result 1", "result 2", "result 3", "dropped 4", "dropped 5"]);
  });
});
