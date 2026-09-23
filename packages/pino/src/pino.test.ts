import { spawn } from "child_process";
import http from "http";
import { AddressInfo } from "net";
import zlib from "zlib";

import { decode } from "@msgpack/msgpack";
import { ILogtailLog, LogLevel } from "@logtail/types";

interface IPinoRun {
  logs: ILogtailLog[];
  stdout: string;
  stderr: string;
  code: number | null;
}

/**
 * Runs `script` in a fresh Node.js process, where `pino` is loaded and `logtail` / `pretty` are transport
 * targets: this transport pointed at a local endpoint, and pino-pretty. Resolves once the process exited,
 * with the logs the endpoint received and what the process printed.
 */
async function runPino(script: string): Promise<IPinoRun> {
  const logs: ILogtailLog[] = [];
  const server = http.createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      logs.push(...(decode(zlib.gunzipSync(Buffer.concat(chunks))) as ILogtailLog[]));
      response.writeHead(202).end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const port = (server.address() as AddressInfo).port;
    const source = `
      const pino = require(${JSON.stringify(require.resolve("pino"))});
      const logtail = {
        target: ${JSON.stringify(require.resolve("@logtail/pino"))},
        options: { sourceToken: "test", options: { endpoint: "http://127.0.0.1:${port}" } },
      };
      const pretty = { target: ${JSON.stringify(require.resolve("pino-pretty"))}, options: { colorize: false } };
      ${script}
    `;

    return await new Promise<IPinoRun>((resolve, reject) => {
      const child = spawn(process.execPath, ["-e", source]);
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => (stdout += chunk));
      child.stderr.on("data", (chunk) => (stderr += chunk));
      child.on("error", reject);
      child.on("exit", (code) => resolve({ logs, stdout, stderr, code }));
    });
  } finally {
    server.close();
  }
}

describe("Pino transport", () => {
  it("should deliver logs from a Pino logger using the transport as its only target", async () => {
    const { logs, stderr, code } = await runPino(`
      const logger = pino(pino.transport(logtail));
      logger.info("one");
      logger.warn({ item: "Orange Soda" }, "two");
      logger.error("three");
    `);

    expect(stderr).toBe("");
    expect(code).toBe(0);
    expect(logs.map((log) => [log.level, log.message])).toEqual([
      [LogLevel.Info, "one"],
      [LogLevel.Warn, "two"],
      [LogLevel.Error, "three"],
    ]);
    expect(logs[1].item).toBe("Orange Soda");
    expect(typeof logs[1].pid).toBe("number");
    expect(logs[1].dt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("should deliver logs alongside pino-pretty when both are targets", async () => {
    const { logs, stdout, stderr, code } = await runPino(`
      const logger = pino(pino.transport({ targets: [logtail, pretty] }));
      logger.info("one");
      logger.warn("two");
      logger.error("three");
    `);

    expect(stderr).toBe("");
    expect(code).toBe(0);
    expect(logs.map((log) => [log.level, log.message])).toEqual([
      [LogLevel.Info, "one"],
      [LogLevel.Warn, "two"],
      [LogLevel.Error, "three"],
    ]);
    expect(stdout).toMatch(/INFO.*: one\n/);
    expect(stdout).toMatch(/ERROR.*: three\n/);
  });
});
