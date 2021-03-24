# 🪵 Logtail - Node.js logging

[![ISC License](https://img.shields.io/badge/license-ISC-ff69b4.svg)](LICENSE.md)

**New to Logtail?** [Here's a low-down on logging in JavaScript.](https://github.com/logtail/logtail-js)

## `@logtail/node`

This NPM library is for logging in Node.js.

If you have a universal or client-side app that requires logging in the browser, check out [`@logtail/browser`](https://github.com/logtail/logtail-js/tree/master/packages/browser) or [`@logtail/js`](https://github.com/logtail/logtail-js/tree/master/packages/js) (which combines the two packages.)

Here's how to get started:

## Installation

Install the package directly from NPM:

```
npm i @logtail/node
```

## Importing

In ES6/Typescript, import the `Logtail` class:

```typescript
import { Logtail } from "@logtail/node";
```

For CommonJS, require the package:

```js
const { Logtail } = require("@logtail/node");
```

## Creating a client

Simply pass your [Logtail.com](https://logtail.com) source access token as a parameter to a new `Logtail` instance (you can grab it from Logtail.com):

```typescript
const logtail = new Logtail("logtail-access-token");
```

## Documentation

This Node.js library extends [`@logtail/core`](https://github.com/logtail/logtail-js/tree/master/packages/core), which provides a simple API for logging, adding middleware and more.

Visit the relevant readme section for more info/how-to:

- [Logging](https://github.com/logtail/logtail-js/tree/master/packages/core#logging)
- [Middleware](https://github.com/logtail/logtail-js/tree/master/packages/core#middleware)

## Streaming

In addition to [`.log|debug|info|warn|error()` returning a Promise](https://github.com/logtail/logtail-js/tree/master/packages/core#logging), the Node.js logger offers a `.pipe()` function for piping successfully synchronized logs to any writable stream.

This makes it trivial to additionally save logs to a file, stream logs over the network, or interface with other loggers that accept streamed data.

Here's a simple example of saving logs to a `logs.txt` file:

```typescript
// Import the Node.js `fs` lib
import * as fs from "fs";

// Import the Node.js Logtail library
import { Logtail } from "@logtail/node";

// Open a writable stream to `logs.txt`
const logsTxt = fs.createWriteStream("./logs.txt");

// Create a new Logtail instance, and pipe output to `logs.txt`
const logtail = new Logtail("logtail-access-token");
logtail.pipe(logsTxt);

// When you next log, `logs.txt` will get a JSON string copy
logtail.log("This will also show up in logs.txt");
```

Streamed logs passed to your write stream's `.write()` function will be JSON strings in the format of type [`ILogtailLog`](https://github.com/logtail/logtail-js/tree/master/packages/types#ilogtaillog), and always contain exactly one complete log _after_ it has been transformed by middleware _and_ synced with Logtail.com.

e.g:

```text
{"dt":"2018-12-29T08:38:33.272Z","level":"info","message":"message 1"}
```

If you want to further process logs in your stream, remember to `JSON.parse(chunk.toString())` the written 'chunk', to turn it back into an [`ILogtailLog`](https://github.com/logtail/logtail-js/tree/master/packages/types#ilogtaillog) object.

Calls to `.pipe()` will return the passed writable stream, allowing you to chain multiple `.pipe()` operations or access any other stream function:

```typescript
// Import a 'pass-through' stream, to prove it works
import { PassThrough } from "stream";

// This stream won't do anything, except copy input -> output
const passThroughStream = new PassThrough();

// Passing to multiple streams works...
logtail.pipe(passThroughStream).pipe(logsTxt);
```

## LICENSE

[ISC](LICENSE.md)
