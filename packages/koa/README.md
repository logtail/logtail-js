# 🪵 Logtail - Koa logging

[![ISC License](https://img.shields.io/badge/license-ISC-ff69b4.svg)](LICENSE.md)

**New to Logtail?** [Here's a low-down on logging in JavaScript.](https://github.com/logtail/logtail-js)

## `@logtail/koa`

This NPM library is for logging [Koa](https://koajs.com/) HTTP web server requests.

It extends the [Logtail Node JS library](https://github.com/logtail/logtail-js/tree/master/packages/node) with Koa middleware.

## Installation

Install the package directly from NPM:

```
npm i @logtail/koa
```

## Importing

In ES6/Typescript, import the `Logtail` class:

```typescript
import { Logtail } from "@logtail/koa";
```

For CommonJS, require the package:

```js
const { Logtail } = require("@logtail/koa");
```

## Creating a client

Simply pass your [Logtail.com](https://logtail.com) source token as a parameter to a new `Logtail` instance:

```typescript
const logtail = new Logtail("logtail-source-token");
```

`Logtail` accepts two optional, additional parameters:

1. [Core logging options](https://github.com/logtail/logtail-js/tree/master/packages/types#ilogtailoptions), allowing you to tweak the interval logs will be sent to Logtail.com, how many concurrent network connections the logger should use, and more. See type [`ILogtailOptions`](https://github.com/logtail/logtail-js/tree/master/packages/types#ilogtailoptions) for details.

2. Koa logging options, specified below.

These can be passed when creating a new `Logtail` instance as follows:

```typescript
const logtailOptions = {
  /**
   * For example -- setting the maximum number of sync requests to
   * make concurrently (useful to limit network I/O)
   */
  syncMax: 10,
};

const koaOptions = {
  // Override default Koa context data to include in each log
  contextPaths: ["statusCode", "request.headers", "request.method"],
};

const logtail = new Logtail(
  "logtail-source-token",
  logtailOptions,
  koaOptions
);
```

## Attaching to Koa

To activate the plugin and enable logging, simply attach a Koa instance:

```typescript
import Koa from "koa";
import { Logtail } from "@logtail/koa";

// Create a new Koa instance
const koa = new Koa();

// Create a new Logtail client
const logtail = new Logtail("logtail-source-token");

// Attach Koa to enable HTTP request logging
logtail.attach(koa);
```

## Koa options

Koa options passed to a new `Logtail` are of type `IKoaOptions`:

```typescript
interface IKoaOptions {
  /**
   * Properties to pluck from the Koa `Context` object
   */
  contextPaths: string[];
}
```

Here are the default properties, which can be overridden:

### `contextPaths`

A `string[]` of paths to pluck from the Koa `ctx` object, which contains details about the request and response of a given Koa HTTP call.

Nested object properties are separated using a period (`.`)

```js
[
  "statusCode",
  "request.headers",
  "request.method",
  "request.length",
  "request.url",
  "request.query",
];
```

## How logging works

All HTTP requests handled by Koa will be logged automatically, and synced with the [Logtail.com](https://logtail.com) service, to the source defined by your Logtail source token.

### Successful requests

A 'successful' request is one that returns a non-`4xx` or `5xx` status code, and doesn't throw any uncaught errors while handling the requests.

These are logged to Logtail using [`LogLevel.Info`](https://github.com/logtail/logtail-js/tree/master/packages/types#loglevel) with the log message:

```
Koa HTTP request: ${ctx.status}
```

### 4xx status codes

These are not considered errors but warnings, and log with the same message using [`LogLevel.Warn`](https://github.com/logtail/logtail-js/tree/master/packages/types#loglevel)

A typical example of a 4xx class of response would be `404 Not Found` or `401 Unauthorized`.

### 5xx status codes

Responses that contain a `5xx` status code are considered errors, and are logged with [`LogLevel.Error`](https://github.com/logtail/logtail-js/tree/master/packages/types#loglevel)

An example of a 5xx status code is `500 Internal Server Error` - typically indicating that something unexpected has happened.

### Uncaught errors

If an error is thrown in Koa middleware and remains uncaught, the Logtail middleware handling will catch, log it with [`LogLevel.Error`](https://github.com/logtail/logtail-js/tree/master/packages/types#loglevel) and re-throw, to handle in your own code.

The log message will be:

```
`Koa HTTP request error: ${(typeof e === "object" && e.message) || e}`
```

If the error thrown is a regular Node.js error object (i.e. has a `.message` property), it will be interpolated with the log message.

Otherwise, an attempt will be made to stringify the message.

If your app throws non-errors, it's recommended that you catch the thrown entity in your code and throw a regular Node.js instead, to provide a useful string message to your log.

## Additional logging

Since this Koa plugin extends the regular [`@logtail/node`](https://github.com/logtail/logtail-js/tree/master/packages/node) logger, you can use the `.log|info|warn|error` functions as normal to handle logging anywhere in your app.

See the [Logtail Node.js logger documentation](https://github.com/logtail/logtail-js/tree/master/packages/node#documentation) for details.

## LICENSE

[ISC](LICENSE.md)
