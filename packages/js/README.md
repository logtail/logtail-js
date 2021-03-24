# 🪵 Logtail - Node.js + browser logging

![Beta: Ready for testing](https://img.shields.io/badge/early_release-beta-green.svg)
![Speed: Blazing](https://img.shields.io/badge/speed-blazing%20%F0%9F%94%A5-brightgreen.svg)
[![ISC License](https://img.shields.io/badge/license-ISC-ff69b4.svg)](LICENSE.md)

**New to Logtail?** [Here's a low-down on logging in Javascript.](https://github.com/logtail/logtail-js)

## `@logtail/js`

This NPM library contains the following two packages:

### [@logtail/browser](https://github.com/logtail/logtail-js/tree/master/packages/browser)

### [@logtail/node](https://github.com/logtail/logtail-js/tree/master/packages/node)

It's provided for convenience, as an alternative to installing multiple packages for universal / isomorphic apps.

## Usage

Here's how to get started:

### Any Node.js environment (including Webpack/Rollup)

First, install the package via NPM:

```
npm i @logtail/js
```

In ES6/Typescript, you can then import either the `Browser` or `Node` class as required for your environment:

```typescript
import { Browser, Node } from "@logtail/js";

// `Browser` is equivalent to the `Logtail` class exported by @logtail/browser
const clientLogger = new Browser("logtail-access-token");

// And the same with `Node` and @logtail/node
const serverLogger = new Node("logtail-access-token");
```

For CommonJS, require the package instead:

```js
const { Browser, Node } = require("@logtail/js");
```

## Logging

Both the Node.js and browser logging classes provide a `.log()` function for logging to [Logtail.com](https://logtail.com)

See the readme for the [Node.js](https://github.com/logtail/logtail-js/tree/master/packages/node) and [browser](https://github.com/logtail/logtail-js/tree/master/packages/browser) logging for the full API.

## FAQ

**Why install this instead of each package separately?**

`@logtail/js` combines the latest `@logtail/browser` and `@logtail/node` packages.

This is useful for apps that contain both Node.js (server) and browser (client) logging. It makes your `package.json` a bit cleaner to maintain just one package, instead of two.

**Why are there different classes for the browser and Node?**

The [browser](https://github.com/logtail/logtail-js/tree/master/packages/browser) and [Node.js](https://github.com/logtail/logtail-js/tree/master/packages/node) APIs both have a `.log()` method and both extend the [core JS logger](https://github.com/logtail/logtail-js/tree/master/packages/core).

But, each have their own optimizations for how they sync logs with Logtail.com, and extra methods to take advantage of unique Node.js and browser features not available in the other environment.

### LICENSE

[ISC](LICENSE.md)
