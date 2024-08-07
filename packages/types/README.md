# [Better Stack](https://betterstack.com/logs) JavaScript client: TypeScript types

📣 Logtail is now part of Better Stack. [Learn more ⇗](https://betterstack.com/press/introducing-better-stack/)

[![ISC License](https://img.shields.io/badge/license-ISC-ff69b4.svg)](LICENSE.md)

**Looking for a logging solution?**  
Check out [Better Stack](https://betterstack.com/logs) and [Better Stack clients for JavaScript and Node.js](https://betterstack.com/docs/logs/javascript/).

## `@logtail/types`

The Logtail JS library packages are written in TypeScript.

Various types are shared between multiple packages. Those shared types have been separated out into their own package, to make it easier for importing.

That's what you'll find in this package.

## Importing types

You can import a shared type into a TypeScript project by importing directly from this package:

```typescript
// For example, `ILogtailLog`
import { ILogtailLog } from "@logtail/types";
```

## Types

### `ILogtailOptions`

Config options for the Logtail [Base class](https://github.com/logtail/logtail-js/tree/master/packages/core#the-base-class) for creating a Logtail client instance.

```typescript
export interface ILogtailOptions {
  /**
   * Endpoint URL for syncing logs with Better Stack
   */
  endpoint: string;

  /**
   * Maximum number of logs to sync in a single request to Better Stack
   */
  batchSize: number;

  /**
   * Max interval (in milliseconds) before a batch of logs proceeds to syncing
   */
  batchInterval: number;

  /**
   * Maximum number of times to retry a failed sync request
   */
  retryCount: number;

  /**
   * Minimum number of milliseconds to wait before retrying a failed sync request
   */
  retryBackoff: number;

  /**
   * Maximum number of sync requests to make concurrently (useful to limit network I/O)
   */
  syncMax: number;

  /**
   * Length of the checked window for logs burst protection in milliseconds (0 to disable)
   */
  burstProtectionMilliseconds: number;

  /**
   * Maximum number of accepted logs in the specified time window (0 to disable)
   */
  burstProtectionMax: number;

  /**
   * Boolean to specify whether thrown errors/failed logs should be ignored
   * Has precedence over throwExceptions
   */
  ignoreExceptions: boolean;

  /**
   * Errors when sending logs will result in thrown exceptions
   */
  throwExceptions: boolean;

  /**
   * Maximum depth (number of attribute levels) of a context object
   */
  contextObjectMaxDepth: number;

  /**
   * Boolean to produce a warning when context object max depth is reached
   */
  contextObjectMaxDepthWarn: boolean;

  /**
   * Boolean to produce a warning when circular reference is found in context
   */
  contextObjectCircularRefWarn: boolean;

  /**
   * If true, all logs will be sent to standard console functions (console.info, console.warn, ...)
   */
  sendLogsToConsoleOutput: boolean;

  /**
   * If true, all logs will be sent to Better Stack
   */
  sendLogsToBetterStack: boolean;
}
```

### `LogLevel`

Enum representing a log level between _debug_ -> _error_:

```typescript
enum LogLevel {
  Debug = "debug",
  Info = "info",
  Warn = "warn",
  Error = "error",
}
```

### `Context`

You can add meta information to your logs by adding a `string`, `boolean`, `Date` or `number` to a string field (or any nested object containing fields of the same.)

We call this 'context' and these are the types:

```typescript
/**
 * Context type - a nested object of serializable types (a string / number / bool / null / undefined / Array / Date / Error)
 */
export type ContextKey = any;
export type Context = { [key: string]: ContextKey };
```

### `ILogtailLog`

The log object which is implicitly created by calling `.log()` (or any explicit log level function - e.g. `.info()`), and is passed down the chain for Better Stack middleware before syncing with [Better Stack](https://logs.betterstack.com)

```typescript
interface ILogtailLog {
  dt: Date;
  level: LogLevel; // <-- see `LogLevel` above
  message: string;
  [key: string]: ContextKey; // <-- see `Context` above
}
```

### `Middleware`

A type representing a [Middleware function](https://github.com/logtail/logtail-js/tree/master/packages/core#middleware) passed to `.use()` (or `.remove()`)

```typescript
type Middleware = (log: ILogtailLog) => Promise<ILogtailLog>;
```

### `Sync`

The type of the function passed to `.setSync()`, for syncing a log with [Better Stack](https://logs.betterstack.com):

Note: Differs from the `Middleware` type because it receives - and resolves to a Promise of - an array of batched `ILogtailLog`.

```typescript
Sync = (logs: ILogtailLog[]) => Promise<ILogtailLog[]>;
```

## LICENSE

[ISC](LICENSE.md)
