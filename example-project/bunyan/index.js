/**
 * This project showcases logging to Better Stack from Bunyan, through the @logtail/bunyan stream
 *
 * For more information visit https://github.com/logtail/logtail-js
 */

const bunyan = require("bunyan");
const { Logtail } = require("@logtail/node");
const { LogtailStream } = require("@logtail/bunyan");

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

// Create a Bunyan logger, passing in the Better Stack stream
const logger = bunyan.createLogger({
  name: "Example logger",
  level: "debug",
  streams: [
    {
      stream: new LogtailStream(logtail),
    },
  ],
});

// Log as usual in Bunyan, your logs are sent to Better Stack
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
  // Bunyan logs an error passed as the first argument as the err field, with its message and stack
  logger.error(err, "Oops! An runtime ERROR occurred!");
}

// Send everything logged so far before the process exits
logtail.flush().then(() => {
  console.info("All done! You can check your logs now.");

  // A log Better Stack did not accept, e.g. because of a wrong source token, counts as logged but not synced
  if (logtail.logged !== logtail.synced) {
    console.error(`Not all logs have been synced! Logged ${logtail.logged}, synced ${logtail.synced}.`);
    process.exitCode = 1;
  }
});
