# 🪵 Logtail - Winston transport

![Beta: Ready for testing](https://img.shields.io/badge/early_release-beta-green.svg)
![Speed: Blazing](https://img.shields.io/badge/speed-blazing%20%F0%9F%94%A5-brightgreen.svg)
[![ISC License](https://img.shields.io/badge/license-ISC-ff69b4.svg)](LICENSE.md)

**New to Logtail?** [Here's a low-down on logging in Javascript.](https://github.com/logtail/logtail-js)

## `@logtail/winston`

This NPM library is for creating a [Winston 3.x](https://github.com/winstonjs/winston)-compatible transport that transmits logs to Logtail.com via the `@logtail/node` logger.

Here's how to get started:

## Installation

Install the Node.js Logtail logger and the Winston transport via NPM:

```
npm i @logtail/node @logtail/winston
```

## Importing

In ES6/Typescript, import both the `Logtail` logger class and the Logtail Winston transport class:

```typescript
import { Logtail } from "@logtail/node";
import { LogtailTransport } from "@logtail/winston";
```

For CommonJS, require the packages instead:

```js
const { Logtail } = require("@logtail/node");
const { LogtailTransport } = require("@logtail/winston");
```

## Creating a client/transport

You can [create a client](https://github.com/logtail/logtail-js/tree/master/packages/node#creating-a-client) the usual way for `@logtail/node`, and then pass it into a new instance of `LogtailTransport`:

```typescript
// Assuming you've imported the Logtail packages above,
// also import Winston...
import winston from "winston";

// Create a Logtail client
const logtail = new Logtail("logtail-access-token");

// Create a Winston logger - passing in the Logtail transport
const logger = winston.createLogger({
  transports: [new LogtailTransport(logtail)],
});

// Log as normal in Winston - your logs will sync with Logtail.com!
logger.log({
  level: "info", // <-- will use Logtail's `info` log level,
  message: "Some message", // <-- will also be passed to Logtail
});
```

## LICENSE

[ISC](LICENSE.md)
