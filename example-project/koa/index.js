/**
 * This project showcases logging to Better Stack from a Koa app: @logtail/koa logs every HTTP request, and its
 * client logs anything else you want, like the Node.js client does
 *
 * For more information visit https://github.com/logtail/logtail-js
 */

const Koa = require("koa");
const { Logtail } = require("@logtail/koa");

// Read the source token and ingesting host from the environment
const sourceToken = process.env.BETTER_STACK_SOURCE_TOKEN;
const ingestingHost = process.env.BETTER_STACK_INGESTING_HOST;
if (!sourceToken || !ingestingHost) {
  console.error(
    "Usage: BETTER_STACK_SOURCE_TOKEN=<source_token> BETTER_STACK_INGESTING_HOST=<ingesting_host> node index.js",
  );
  process.exit(1);
}
const port = process.env.PORT || 3000;

// Create a Koa app and a Better Stack client
const app = new Koa();
const logtail = new Logtail(sourceToken, {
  endpoint: `https://${ingestingHost}`,
});

// Attach the client to the app: it logs every request with its method, URL, headers and status
logtail.attach(app);

app.use(async (ctx) => {
  // The client logs like the Node.js one, anywhere in your app
  logtail.debug("I am using Better Stack!");
  logtail.info("An interesting event occurred!");

  // Structured data is passed as the second argument
  logtail.warn("Something is not quite right, better check on it.", {
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
    logtail.error("Oops! An runtime ERROR occurred!", err);
  }

  ctx.body = "Hello World";
});

const server = app.listen(port, () => {
  console.info(`Listening on http://localhost:${port}, open it to log a request`);
});

// On Ctrl+C or a stop signal, send what is left to Better Stack before exiting
async function shutDown() {
  server.close();
  await logtail.flush();
  console.info("All done! You can check your logs now.");

  // A log Better Stack did not accept, e.g. because of a wrong source token, counts as logged but not synced
  if (logtail.logged !== logtail.synced) {
    console.error(`Not all logs have been synced! Logged ${logtail.logged}, synced ${logtail.synced}.`);
    process.exit(1);
  }
  process.exit(0);
}
process.on("SIGINT", shutDown);
process.on("SIGTERM", shutDown);
