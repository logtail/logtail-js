import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { PassThrough, Writable } from "stream";

import nock from "nock";
import { ILogtailLog, LogLevel } from "@logtail/types";

import { Node } from "./node";
import { Mock } from "jest-mock";

/**
 * Create a log with a random string / current date
 */
function getRandomLog(message: string): Partial<ILogtailLog> {
  return {
    dt: new Date(),
    level: LogLevel.Info,
    message,
  };
}

describe("node tests", () => {
  it("should echo log if logtail sends 20x status code", async () => {
    nock("https://in.logs.betterstack.com").post("/").reply(201);

    const message: string = String(Math.random());
    const expectedLog = getRandomLog(message);
    const node = new Node("valid source token", { throwExceptions: true });
    const echoedLog = await node.log(message);
    expect(echoedLog.message).toEqual(expectedLog.message);
  });

  it("should throw error if logtail sends non 200 status code", async () => {
    nock("https://in.logs.betterstack.com").post("/").reply(401);

    const node = new Node("invalid source token", { throwExceptions: true });
    const message: string = String(Math.random);
    await expect(node.log(message)).rejects.toThrow();
  });

  it("should warn and echo log even with circular reference as context", async () => {
    nock("https://in.logs.betterstack.com").post("/").reply(201);

    let circularContext: any = { foo: { value: 42 } };
    circularContext.foo.bar = circularContext;

    // Mock console warnings
    const originalConsoleWarn = console.warn;
    console.warn = jest.fn();

    const message: string = String(Math.random());
    const expectedLog = getRandomLog(message);
    const node = new Node("valid source token", { throwExceptions: true });
    const echoedLog = await node.log(message, LogLevel.Info, circularContext);
    expect(echoedLog.message).toEqual(expectedLog.message);

    expect((console.warn as Mock).mock.calls).toHaveLength(1);
    expect((console.warn as Mock).mock.calls[0][0]).toBe(
      "[Logtail] Found a circular reference when serializing logs. Please do not use circular references in your logs.",
    );
    console.warn = originalConsoleWarn;
  });

  it("should enable piping logs to a writable stream", async () => {
    // Create a writable stream
    const writeStream = new Writable({
      write(chunk: any, encoding: string, callback: (error?: Error | null) => void): void {
        // Will be a buffered JSON string -- parse
        const log: ILogtailLog = JSON.parse(chunk.toString());

        // Expect the log to match the message
        expect(log.message).toEqual(message);

        callback();
      },
    });

    // Fixtures
    const logtail = new Node("test", { throwExceptions: true });
    logtail.pipe(writeStream);

    const message = "This should be streamed";

    // Mock the sync method by simply returning the same logs
    logtail.setSync(async (logs) => logs);

    // Fire a log event
    await logtail.log(message);
  });

  it("should pipe logs to a writable file stream", async () => {
    // Create a temporary file name
    const temp = path.join(os.tmpdir(), `logtail_${Math.random()}`);

    // Create a write stream based on that temp file
    const writeStream = fs.createWriteStream(temp);

    // Create a Pass-through stream, to ensure multiplexing works
    const passThrough = new PassThrough();

    // Pass write stream to Better Stack
    const logtail = new Node("test", { throwExceptions: true });
    logtail.pipe(passThrough).pipe(writeStream);

    // Mock the sync method by simply returning the same logs
    logtail.setSync(async (logs) => logs);

    // Create messages
    const messages = ["message 1", "message 2"];

    // Log messages
    await Promise.all(messages.map((msg) => logtail.log(msg)));

    writeStream.on("finish", () => {
      // Get the stored data, and translate back to JSON
      const data = fs
        .readFileSync(temp)
        .toString()
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));

      // Messages should match
      for (let i = 0; i < messages.length; i++) {
        expect(data[i].message).toEqual(messages[i]);
      }
    });

    writeStream.end();
  });

  it("should drop logs when queue limit is exceeded", async () => {
    let requestCount = 0;
    nock("https://in.logs.betterstack.com")
      .post("/")
      .times(10)
      .delay(500) // 500ms delay
      .reply(201, () => {
        requestCount++;
      });

    const node = new Node("test-token", {
      syncMax: 2, // Only 2 concurrent batches
      syncQueuedMax: 3, // Only 3 batches can be queued
      batchSize: 2, // Two logs per batch
      ignoreExceptions: true, // Do not print the exceptions to console during test
      retryCount: 0,
    });

    // Send 24 logs rapidly
    const promises = [];
    for (let i = 0; i < 24; i++) {
      promises.push(node.log(`Message ${i}`));
    }

    // Wait a bit for queue processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 2 immediate batches of 2
    expect(requestCount).toBe(2);
    // which haven't synced yet
    expect(node.synced).toBe(0);
    // 24 logs in total - 2 immediate batches of 2 - 3 queued batches of 2
    expect(node.dropped).toBe(14);

    // Wait for the queue to finish
    await Promise.all(promises);

    // 2 immediate batches of 2 + 3 queued batches of 2
    expect(requestCount).toBe(5);
    expect(node.synced).toBe(10);
    // 24 in total - 5 done batches of 2
    expect(node.dropped).toBe(14);
  });

  it("should timeout when request takes longer than configured timeout", async () => {
    // Mock a slow endpoint
    nock("https://in.logs.betterstack.com")
      .post("/")
      .delay(300) // 300ms delay
      .reply(201);

    const node = new Node("test-token", {
      timeout: 200, // 200ms timeout
      throwExceptions: true,
      retryCount: 0,
    });

    // This should timeout
    await expect(node.log("Test message")).rejects.toThrow("Request timeout after 200ms");
  });

  it("should complete successfully when request is within timeout", async () => {
    // Mock a normal endpoint
    nock("https://in.logs.betterstack.com")
      .post("/")
      .delay(100) // 100ms delay
      .reply(201);

    const node = new Node("test-token", {
      timeout: 1000, // 1s timeout
      throwExceptions: true,
      retryCount: 0,
    });

    // This should succeed
    const result = await node.log("Test message");
    expect(result).toHaveProperty("message", "Test message");
  });

  it("should work without timeout when timeout is 0", async () => {
    // Mock a slow endpoint
    nock("https://in.logs.betterstack.com")
      .post("/")
      .delay(100) // 100ms delay
      .reply(200);

    const node = new Node("test-token", {
      timeout: 0, // No timeout
      throwExceptions: true,
      retryCount: 0,
    });

    // This should complete despite the delay
    const result = await node.log("Test message");
    expect(result).toHaveProperty("message", "Test message");
  });
});
