# 🪵 Logtail - Browser logging

[![ISC License](https://img.shields.io/badge/license-ISC-ff69b4.svg)](LICENSE.md)

**New to Logtail?** [Here's a low-down on logging in JavaScript.](https://github.com/logtail/logtail-js)

## `@logtail/browser`

This NPM library is for logging in the browser.

Here's how to get started:

## Installation

### Using Webpack / Rollup

If you're using a module bundler like Webpack or Rollup, you can install the package directly from NPM:

```
npm i @logtail/browser
```

In ES6/Typescript, import the `Logtail` class:

```typescript
import { Logtail } from "@logtail/browser";
```

For CommonJS, require the package:

```js
const { Logtail } = require("@logtail/browser");
```

### Via a `<script>` tag

If you're not using a Node.js module bundler, you can log in any client-side app by dropping in a `<script>` tag:

```
<script src="https://unpkg.com/@logtail/browser@0.31.0/dist/umd/logtail.js"></script>
```

This will place the `Logtail` class on `window.Logtail`.

## Creating a client

You can instantiate the client in the same way, whether you use a module bundler or the `<script>` tag method.

Simply pass your [Logtail.com](https://logtail.com) organization API + source keys as parameters to a new `Logtail` instance (you can grab both from the Logtail.com console):

```typescript
const logtail = new Logtail("logtail-source-token");
```

## Documentation

This browser library extends [`@logtail/core`](https://github.com/logtail/logtail-js/tree/master/packages/core), which provides a simple API for logging, adding middleware and more.

Visit the relevant readme section for more info/how-to:

- [Logging](https://github.com/logtail/logtail-js/tree/master/packages/core#logging)
- [Middleware](https://github.com/logtail/logtail-js/tree/master/packages/core#middleware)

## LICENSE

[ISC](LICENSE.md)
