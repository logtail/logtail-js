/**
 * This project showcases logging to Better Stack from Pino, through the @logtail/pino transport
 *
 * For more information visit https://github.com/logtail/logtail-js
 */

const pino = require("pino");

// Read the source token and ingesting host from the environment
const sourceToken = process.env.BETTER_STACK_SOURCE_TOKEN;
const ingestingHost = process.env.BETTER_STACK_INGESTING_HOST;
if (!sourceToken || !ingestingHost) {
  console.error(
    "Usage: BETTER_STACK_SOURCE_TOKEN=<source_token> BETTER_STACK_INGESTING_HOST=<ingesting_host> node index.js",
  );
  process.exit(1);
}

// The transport runs in a worker thread, which sends the logs to Better Stack
const transport = pino.transport({
  target: "@logtail/pino",
  options: {
    sourceToken,
    options: { endpoint: `https://${ingestingHost}` },
  },
});
const logger = pino({ level: "debug" }, transport);

// Log as usual in Pino, your logs are sent to Better Stack
logger.debug("I am using Better Stack!");
logger.info("An interesting event occurred!");

// Structured data is passed as the first argument
logger.warn(
  {
    user: {
      username: "someuser",
      email: "someuser@example.com",
    },
    additional_info: {
      tried_accessing: "/url/of/error",
    },
  },
  "Something is not quite right, better check on it.",
);

try {
  throw new Error("Testing error");
} catch (err) {
  // Pino logs an error passed as the first argument as the err field, with its message and stack
  logger.error(err, "Oops! An runtime ERROR occurred!");
}

// When the process exits, Pino ends the transport, which sends what is left before the worker stops
console.info("All done! You can check your logs now.");
