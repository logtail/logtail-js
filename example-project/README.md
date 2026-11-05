# Better Stack JavaScript example projects

To help you get started with using Better Stack Logs in your projects, we have prepared small programs that showcase logging to Better Stack from Node.js, Bun, the browser, an edge runtime and the popular Node.js logging libraries. Each one sends the same four logs: a debug and an info message, a warning with structured data and an error.

| Example              | Runs on            | Uses                            |
| -------------------- | ------------------ | ------------------------------- |
| [`node`](node)       | Node.js or Bun     | `@logtail/js`                   |
| [`winston`](winston) | Node.js            | `@logtail/winston` with Winston |
| [`pino`](pino)       | Node.js            | `@logtail/pino` with Pino       |
| [`bunyan`](bunyan)   | Node.js            | `@logtail/bunyan` with Bunyan   |
| [`koa`](koa)         | Node.js            | `@logtail/koa` in a Koa app     |
| [`browser`](browser) | a browser          | `@logtail/browser` from a CDN   |
| [`edge`](edge)       | Cloudflare Workers | `@logtail/edge` in a Worker     |

You need your source token and ingesting host, which you can find by going to **[Sources](https://telemetry.betterstack.com/team/0/sources) -> Configure** in Better Stack.

## Run an example

Download the example projects from GitHub directly or clone the repository, then install the dependencies of the example you want to run and run it with your source token and ingesting host in the environment. Make sure you have `npm` and [Node.js](https://nodejs.org/en/download/) installed.

```bash
cd example-project/node   # or winston, pino, bunyan
npm install
export BETTER_STACK_SOURCE_TOKEN=<source_token>
export BETTER_STACK_INGESTING_HOST=<ingesting_host>
node index.js             # or: bun index.js
```

_Don't forget to replace `<source_token>` and `<ingesting_host>` with your actual source token and ingesting host._

You should see the following output:

```
Output:
All done! You can check your logs now.
```

This will generate a total of 4 logs, which will be displayed in your Better Stack Logs live tail view. The example exits with code 1 when Better Stack did not accept them, e.g. because of a wrong source token. The Pino transport sends from a worker thread, so the pino example cannot tell. Detail explanation follows below.

The other examples run a little differently:

- **koa** starts a server: run `node index.js` as above, open [http://localhost:3000](http://localhost:3000) to log the four logs and the request, and stop the server with Ctrl+C, which sends what is left.
- **browser** is a single page: replace `<source_token>` and `<ingesting_host>` in `index.html`, open it in a browser and check the browser console.
- **edge** is a Cloudflare Worker: run `npm install`, put `BETTER_STACK_SOURCE_TOKEN=<source_token>` and `BETTER_STACK_INGESTING_HOST=<ingesting_host>` on two lines of a `.dev.vars` file, run `npx wrangler dev` and open the URL it prints. Deploy it with `npx wrangler deploy` after setting both values with `npx wrangler secret put`.

These examples are also what the [E2E workflow](../.github/workflows/e2e.yml) runs every day against Better Stack.

# Logging

The `logger` instance we created in the installation section is used to send log messages to Better Stack Logs. It provides 4 logging methods for the 4 default log levels. The log levels and their method are:

- **DEBUG** - Send debug messages using the `debug()` method
- **INFO** - Send informative messages about the application progress using the `info()` method
- **WARN** - Report non-critical issues using the `Warn()` method
- **ERROR** - Send messages about serious problems using the `error()` method

## Logging example

To send a log message of select log level, use the corresponding method. In this example, we will send the **DEBUG** level log and **ERROR** level log.

```jsx
// Send debug level log using the debug() method
logger.debug("I am using Better Stack!");

// Send error level log using the error() method
logger.error("Oops! An runtime ERROR occurred!");
```

This will create the following JSON output:

```json
{
   "dt":"2022-02-01 12:01:10.127 UTC",
   "context":{
      "runtime":{
         "column_integer":"21",
         "file_string":"node_modules/@logtail/core/dist/cjs/base.js",
         "line_integer":"141",
         "type_string":"Node",
         "function_string":"debug",
         "method_string":"debug"
      },
      "system":{
         "main_file_string":"/mnt/d/js_logtail/index.js",
         "pid_integer":"4193"
      }
   },
   "level_string":"debug",
   "message_string":"I am using Better Stack!"
}

{
   "dt":"2022-02-01 12:01:10.127 UTC",
   "context":{
      "runtime":{
         "column_integer":"8",
         "file_string":"index.js",
         "line_integer":"40",
         "type_string":"Object"
      },
      "system":{
         "main_file_string":"/mnt/d/js_logtail/index.js",
         "pid_integer":"4193"
      }
   },
   "level_string":"error",
   "message_string":"Oops! An runtime ERROR occurred!"
}

```

## Logging structured data

You can log additional structured data to help you troubleshoot your application much quicker. Pass the structured data as the second argument to the select login method as shown in the example below:

```jsx
logger.warn("Something is not quite right, better check on it.", {
  user: {
    username: "someuser",
    email: "someuser@example.com",
  },
  additional_info: {
    tried_accessing: "/url/of/error",
  },
});
```

This will create the following JSON output:

```json
{
  "dt": "2022-02-01 12:01:10.127 UTC",
  "context": {
    "runtime": {
      "column_integer": "8",
      "file_string": "index.js",
      "line_integer": "29",
      "type_string": "Object"
    },
    "system": {
      "main_file_string": "/mnt/d/js_logtail/index.js",
      "pid_integer": "4193"
    }
  },
  "level_string": "warn",
  "message_string": "Something is not quite right, better check on it.",
  "additional_info": {
    "tried_accessing_string": "/url/of/error"
  },
  "user": {
    "email_string": "someuser@example.com",
    "username_string": "someuser"
  }
}
```

## Middleware

You can intercept every logged item and modify it before it's pushed to Better Stack. This could be useful for example for adding the current user's ID to the log:

```jsx
// intercept the log and add userId to the content
async function enrichLogs(log) {
  return {
    ...log,
    userId: getCurrentUserId(),
  };
}

// tell logtail to use the intercept function
logtail.use(enrichLogs);
```

## TypeScript support

If you're using Better Stack in a TypeScript codebase, you can take advantage of our types. The custom middleware function from the previous example could look like this:

```jsx
import { ILogtailLog } from "@logtail/types";

async function enrichLogs(log: ILogtailLog): Promise<ILogtailLog> {
  return {
    ...log,
    userId: getCurrentUserId(),
  };
}
```

# Integrations

We provide integrations with several existing frameworks and logging solutions.

## Koa

Install the following `@logtail/koa` NPM package and then attach the Logtail instance as a middleware to your Koa instance:

```bash
npm install @logtail/koa
```

```jsx
const Koa = require("koa");
const { Logtail } = require("@logtail/koa");

// Create a new Koa instance
const koa = new Koa();

// Create a new Better Stack Logs client
const logtail = new Logtail("<source-token>", {
  endpoint: "<ingesting-host>",
});

// Attach Koa to enable HTTP request logging
logtail.attach(koa);
```

_Don't forget to replace with your actual source token which you can find by going to logs.betterstack.com -> sources -> edit._

### How the middleware works

**Successful requests**

A _successful_ request is one that returns a non-`4xx` or `5xx` status code and doesn't throw any uncaught errors while handling the requests. These are logged to Better Stack using `[LogLevel.Info](https://github.com/logtail/logtail-js/tree/master/packages/types#loglevel)`

**4xx status codes**

These are not considered errors but warnings and log with the same message using `[LogLevel.Warn](https://github.com/logtail/logtail-js/tree/master/packages/types#loglevel)`

**5xx status codes**

Responses that contain a `5xx` status code are considered errors and are logged with `[LogLevel.Error](https://github.com/logtail/logtail-js/tree/master/packages/types#loglevel)`

### Additional logging

Since this Koa plugin extends the regular `[@logtail/node](https://github.com/logtail/logtail-js/tree/master/packages/node)` logger, you can use the `.log|info|warn|error` functions as normal to handle logging anywhere in your app.

## Winston

Install the `@logtail/winston` NPM package and set up the Better Stack transport according to the following example

```bash
npm install @logtail/winston
npm install @logtail/node
```

```jsx
const winston = require("winston");
const { Logtail } = require("@logtail/node");
const { LogtailTransport } = require("@logtail/winston");

// Create a Better Stack Logs client
const logtail = new Logtail("<source-token>", {
  endpoint: "<ingesting-host>",
});

// Create a Winston logger - passing in the Logtail transport
const logger = winston.createLogger({
  transports: [new LogtailTransport(logtail)],
});

// Log as normal in Winston - your logs will sync with Better Stack!
logger.log({
  level: "info", // <-- will use Logtail's `info` log level,
  message: "Some message", // <-- will also be passed to Logtail
});
```

_Don't forget to replace with your actual source token which you can find by going to logs.betterstack.com -> sources -> edit._

## Bunyan

Install the `@logtail/bunyan` NPM package and set up the Logtail stream according to the following example:

```bash
npm install @logtail/bunyan
npm install @logtail/node
```

```jsx
const bunyan = requrie("bunyan");
const { Logtail } = require("@logtail/node");
const { LogtailStream } = require("@logtail/bunyan");

// Create a Better Stack Logs client
const logtail = new Logtail("logtail-source-token", {
  endpoint: "<ingesting-host>",
});

// Create a Bunyan logger - passing in the Logtail stream
const logger = bunyan.createLogger({
  name: "Example logger",
  level: "debug",
  streams: [
    {
      stream: new LogtailStream(logtail),
    },
  ],
});

// Log as normal in Bunyan - your logs will be sent to Better Stack
logger.info("Hello from Bunyan");
```

_Don't forget to replace with your actual source token which you can find by going to logs.betterstack.com -> sources -> edit._
