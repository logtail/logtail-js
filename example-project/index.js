/**
 * This project showcases Better Stack Logs JavaScript integration for
 * both backend and frontend code
 *
 * This code uses the @logtail/js package which can be used for both frontend and backend
 *
 * For more infromation visit https://github.com/logtail/logtail-js
 */

// Require Logtail Class for backend code (Node.js)
const { Node: Logtail } = require("@logtail/js");

// In frontend code use the following:
// import { Browser as Logtail } from "@logtail/js";

// Create a logger from a Logtail class
const logger = new Logtail(process.argv[2], { sendLogsToConsoleOutput: true });

// Usage

// Send debug level log using the debug() method
const debugLog = logger.debug(
  `I am using Better Stack! (${process.title} v${
    process.versions?.[process.title]
  })`,
);

// Send info level log using the info() method
const infoLog = logger.info("An interesting event occurred!");

// Send warn level log using the warn() method
// You can add additional structured data to help you troubleshoot your code as shown below
const warningLog = logger.warn(
  "Something is not quite right, better check on it.",
  {
    user: {
      username: "someuser",
      email: "someuser@example.com",
    },
    additional_info: {
      tried_accessing: "/url/of/error",
    },
  },
);

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

// Example of logging in a custom helper method, ensuring context.runtime still contains helpful info
function logWithNodeVersion(message) {
  // The stackContextHint defines where in the call stack logger should look for the runtime context
  // Now, context.runtime should contain information about where logWithNodeVersion() was called from
  const stackContextHint = {
    fileName: "index.js",
    methodNames: [ "logWithNodeVersion" ],
  };
  return logger.log(message, "info", { nodeVersion: process.version }, stackContextHint)
}
const customHelperLog = logWithNodeVersion("Logging using custom helper function.");


// Logging methods are async function returning Promises
Promise.all([debugLog, infoLog, warningLog, errorLog, customHelperLog]).then(function() {
  console.info("All done! You can check your logs now.");

  console.log("Logs created: ", logger.logged);
  console.log("Successfully synced logs: ", logger.synced);

  if (logger.logged !== logger.synced) {
    console.error("Not all logs have been synced!");
    process.exit(1);
  }
});
