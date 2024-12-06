/**
 * This project showcases Better Stack Logs JavaScript integration for
 * both backend and frontend code
 *
 * This code uses the @logtail/js package which can be used for both frontend and backend
 *
 * For more infromation visit https://github.com/logtail/logtail-js
 */

const pino = require('pino');
const transport = pino.transport({
  target: "@logtail/pino",
  options: { sourceToken: process.argv[2] }
});
const logger = pino(transport);

// Usage

// Send debug level log using the debug() method
logger.debug(`I am using Better Stack! (${process.title} v${process.versions?.[process.title]})`);

// Send info level log using the info() method
logger.info("An interesting event occurred!");

// Send warn level log using the warn() method
// You can add additional structured data to help you troubleshoot your code as shown below
logger.warn("Something is not quite right, better check on it.", {
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

try {
  callbackThatMightFail();
} catch (err) {
  // Send error level log using the error() method
  logger.error("Oops! An runtime ERROR occurred!", err);
}

logger.info("Logs can be \033[1mbold\033[0m, \033[31mred\033[0m, or \033[1;32mbold green\033[0m (octal escape).");

logger.info("Logs can be \u001B[1mbold\u001B[0m, \u001B[31mred\u001B[0m, or \u001B[1;32mbold green\u001B[0m (unicode escape).");
