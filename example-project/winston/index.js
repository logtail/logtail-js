/**
 * This project showcases logging to Better Stack from Winston, through the @logtail/winston transport
 *
 * For more information visit https://github.com/logtail/logtail-js
 */

const winston = require("winston");
const { Logtail } = require("@logtail/node");
const { LogtailTransport } = require("@logtail/winston");

// Read the source token and ingesting host from the environment
const sourceToken = process.env.BETTER_STACK_SOURCE_TOKEN;
const ingestingHost = process.env.BETTER_STACK_INGESTING_HOST;
if (!sourceToken || !ingestingHost) {
  console.error(
    "Usage: BETTER_STACK_SOURCE_TOKEN=<source_token> BETTER_STACK_INGESTING_HOST=<ingesting_host> node index.js",
  );
  process.exit(1);
}

// Create a Better Stack client
const logtail = new Logtail(sourceToken, {
  endpoint: `https://${ingestingHost}`,
});

// Create a Winston logger, passing in the Better Stack transport
const logger = winston.createLogger({
  level: "debug",
  transports: [new LogtailTransport(logtail)],
});

// Log as usual in Winston, your logs are sent to Better Stack
logger.debug("I am using Better Stack!");
logger.info("An interesting event occurred!");

// Structured data is passed as the second argument
logger.warn("Something is not quite right, better check on it.", {
  user: {
    username: "someuser",
    email: "someuser@example.com",
  },
  additional_info: {
    tried_accessing: "/url/of/error",
  },
});

try {
  throw new Error("Testing error");
} catch (err) {
  // Winston appends the error's message to the log message and adds its stack
  logger.error("Oops! An runtime ERROR occurred!", err);
}

// logger.end() finishes once the transport has sent every log
logger.on("finish", () => {
  console.info("All done! You can check your logs now.");

  // A log Better Stack did not accept, e.g. because of a wrong source token, counts as logged but not synced
  if (logtail.logged !== logtail.synced) {
    console.error(`Not all logs have been synced! Logged ${logtail.logged}, synced ${logtail.synced}.`);
    process.exitCode = 1;
  }
});
logger.end();
