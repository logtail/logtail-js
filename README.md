# Logtail - JavaScript Logging Made Easy
  
  [![Logtail dashboard](https://user-images.githubusercontent.com/19272921/154085622-59997d5a-3f91-4bc9-a815-3b8ead16d28d.jpeg)](https://betterstack.com/logtail)


[![ISC License](https://img.shields.io/badge/license-ISC-ff69b4.svg)](LICENSE.md)
[![npm version](https://badge.fury.io/js/@logtail%2Fnode.svg)](https://badge.fury.io/js/@logtail%2Fnode)
[![npm version](https://badge.fury.io/js/@logtail%2Fbrowser.svg)](https://badge.fury.io/js/@logtail%2Fbrowser)
[![npm version](https://badge.fury.io/js/@logtail%2Fjs.svg)](https://badge.fury.io/js/@logtail%2Fjs)
![Logtail python client](https://github.com/logtail/logtail-python/actions/workflows/main.yml/badge.svg?branch=master)

Collect logs from both the Node.js backend and your frontend.

[Logtail](https://betterstack.com/logtail) is a hosted service that centralizes all of your logs into one place. Allowing for analysis, correlation and filtering with SQL. Actionable Grafana dashboards and collaboration come built-in. Logtail works with [any language or platform and any data source](https://docs.logtail.com/). 

### Features
- Simple integration. Allows for both backend and frontend logging.
- Support for structured logging and events.
- Automatically captures useful context.
- Performant, light weight, with a thoughtful design.

### Supported language versions
- Node.js 12 or newer

# Installation
## Backend only

Install Logtail library for your Node.js backend code using the `npm` package manager:

```bash
npm install @logtail/node
```

Then you can either require it or import it into your codebase:

```jsx
// require logtail class
const { Logtail } = require("@logtail/node");

// or import if you're using ES modules:
import { Logtail } from "@logtail/node";
```

## Frontend only

Install Logtail library for your frontend code using the npm package manager:

```bash
npm install @logtail/browser
```

Then import the Logtail class:

```jsx
// import logtail class
import { Logtail } from "@logtail/browser";
```

Another option is to use Content Delivery Network (CDN). You can import Logtail using the CDN by adding the following line into a page header:

```bash
<script src="https://unpkg.com/browse/@logtail/browser@latest/dist/umd/logtail.js"></script>
```

## Both backend and frontend

If your project contains both Node.js backend code and frontend code as well, you can use the universal package `@logtail/js` which combines the `node` and `browser` packages:

First, install the Logtail library using the `npm` package manager:

```bash
npm install @logtail/js
```

Then import or require it in your code:

```jsx
// in your backend code:
const { Node: Logtail } = require("@logtail/js");

// in your frontend code:
import { Browser as Logtail } from "@logtail/js";
```

---

# Example project

To help you get started with using Logtail in your projects, we have prepared a simple program that showcases the usage of Logtail logger. Before proceeding make sure you have `npm` and [Node.js](https://nodejs.org/en/download/) installed.

## Download and install the example project

You can download the example project from GitHub directly or you can clone it to a select directory. Then run the following command to install all dependencies (`@logtail/js`):

```bash
npm install
```

## Run the example project

To run the example application, simply run the following command:

```bash
node index.js <source-token>
```

*Don't forget to replace <source-token> with your actual source token which you can find by going to logtail.com -> sources -> edit.*

You should see the following output:

```
Output:
All done! You can check your logs now.
```

This will generate a total of 4 logs, which will be displayed in your Logtail live tail view.

## Explore how example project works

Learn how to setup JavaScript logging by exploring the workings of the example project in detail.

---

## Get in touch

Have any questions? Please explore the Logtail [documentation](https://docs.logtail.com/) or contact our [support](https://betterstack.com/help).
