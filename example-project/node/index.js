/**
 * This project showcases Better Stack Logs JavaScript integration for
 * both backend and frontend code
 *
 * This code uses the @logtail/js package which can be used for both frontend and backend
 *
 * For more information visit https://github.com/logtail/logtail-js
 */

// Require Logtail Class for backend code (Node.js)
const { Node: Logtail } = require("@logtail/js");

// In frontend code use the following:
// import { Browser as Logtail } from "@logtail/js";

// Read the source token and ingesting host from the environment
const sourceToken = process.env.BETTER_STACK_SOURCE_TOKEN;
const ingestingHost = process.env.BETTER_STACK_INGESTING_HOST;
if (!sourceToken || !ingestingHost) {
  console.error(
    "Usage: BETTER_STACK_SOURCE_TOKEN=<source_token> BETTER_STACK_INGESTING_HOST=<ingesting_host> node index.js",
  );
  process.exit(1);
}

// Create a logger from a Logtail class
const logger = new Logtail(sourceToken, {
  sendLogsToConsoleOutput: true,
  endpoint: `https://${ingestingHost}`,
});

// Usage

// Send debug level log using the debug() method
const debugLog = logger.debug("I am using Better Stack!");

// Send info level log using the info() method
const infoLog = logger.info("An interesting event occurred!");

// Send warn level log using the warn() method
// You can add additional structured data to help you troubleshoot your code as shown below
const warningLog = logger.warn("Something is not quite right, better check on it.", {
  user: {
    username: "someuser",
    email: "someuser@example.com",
  },
  additional_info: {
    tried_accessing: "/url/of/error",
  },
});

// Example of logging errors in catch clause
function callbackThatMightFail() {
  throw new Error("Testing error");
}

let errorLog;
try {
  callbackThatMightFail();
} catch (err) {
  // Send error level log using the error() method
  errorLog = logger.error("Oops! An runtime ERROR occurred!", err);
}

// Logging methods are async functions returning Promises, which resolve once the log was sent
Promise.all([debugLog, infoLog, warningLog, errorLog]).then(function () {
  console.info("All done! You can check your logs now.");

  console.log("Logs created: ", logger.logged);
  console.log("Successfully synced logs: ", logger.synced);

  // A log Better Stack did not accept, e.g. because of a wrong source token, counts as logged but not synced
  if (logger.logged !== logger.synced) {
    console.error("Not all logs have been synced!");
    process.exit(1);
  }
});
