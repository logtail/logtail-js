# [Better Stack](https://betterstack.com/logs) JavaScript Hono middleware

📣 Logtail is now part of Better Stack. [Learn more ⇗](https://betterstack.com/press/introducing-better-stack/)

[![Better Stack dashboard](https://github.com/logtail/logtail-js/assets/10132717/96b422e7-3026-49c1-bd45-a946c37211d0)](https://betterstack.com/logs)

[![ISC License](https://img.shields.io/badge/license-ISC-ff69b4.svg)](https://github.com/logtail/logtail-js/blob/master/LICENSE.md)
[![npm @logtail/hono](https://img.shields.io/npm/v/@logtail/hono?color=success&label=npm%20%40logtail%2Fhono)](https://www.npmjs.com/package/@logtail/hono)

Experience SQL-compatible structured log management based on ClickHouse. [Learn more ⇗](https://betterstack.com/logs)

## Documentation

[Getting started ⇗](https://betterstack.com/docs/logs/javascript/hono)

## Usage

```js
import { Hono } from "hono";
import { Logtail } from "@logtail/edge"; // or "@logtail/node" when running on Node.js
import { logtail } from "@logtail/hono";

const app = new Hono();
const logger = new Logtail("$SOURCE_TOKEN", { endpoint: "https://$INGESTING_HOST" });

// Log every handled request to Better Stack
app.use(logtail(logger));

app.get("/", (c) => c.text("Hello Hono!"));

export default app;
```

Requests are logged after the response is ready: 2xx and 3xx responses at `info` level, 4xx at `warn`, 5xx and thrown errors at `error`. On Cloudflare Workers the middleware logs through the request's execution context, so logs are delivered after the response is sent.

## Need help?

Please let us know at [hello@betterstack.com](mailto:hello@betterstack.com). We're happy to help!

---

[ISC license](https://github.com/logtail/logtail-js/blob/master/LICENSE.md), [contributing guidelines](https://github.com/logtail/logtail-js/blob/master/CONTRIBUTING.md).
