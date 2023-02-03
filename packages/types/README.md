# [Logtail](https://betterstack.com/logtail) JavaScript client by [Better Stack](https://betterstack.com/) - TypeScript types

[![ISC License](https://img.shields.io/badge/license-ISC-ff69b4.svg)](LICENSE.md)

**Looking for a logging solution?**  
Check out [Logtail](https://logtail.com) and [Logtail clients for JavaScript and Node.js](https://betterstack.com/docs/logs/javascript/).

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
   * Endpoint URL for syncing logs with Logtail.com
   */
  endpoint: string;

  /**
   * Maximum number of logs to sync in a single request to Logtail.com
   */
  batchSize: number;

  /**
   * Max interval (in milliseconds) before a batch of logs proceeds to syncing
   */
  batchInterval: number;

  /**
   * Maximum number of sync requests to make concurrently (useful to limit
   * network I/O)
   */
  syncMax: number;

  /**
   * Boolean to specify whether thrown errors/failed logs should be ignored
   */
  ignoreExceptions: boolean;
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
 * Context type - a string/number/bool/Date, or a nested object of the same
 */
export type ContextKey = string | number | boolean | Date;
export type Context = { [key: string]: ContextKey | Context };
```

### `ILogtailLog`

The log object which is implicitly created by calling `.log()` (or any explicit log level function - e.g. `.info()`), and is passed down the chain for Logtail middleware before syncing with [Logtail.com](https://logtail.com)

```typescript
interface ILogtailLog {
  dt: Date;
  level: LogLevel; // <-- see `LogLevel` above
  message: string;
  [key: string]: ContextKey | Context; // <-- see `Context` above
}
```

### `Middleware`

A type representing a [Middleware function](https://github.com/logtail/logtail-js/tree/master/packages/core#middleware) passed to `.use()` (or `.remove()`)

```typescript
type Middleware = (log: ILogtailLog) => Promise<ILogtailLog>;
```

### `Sync`

The type of the function passed to `.setSync()`, for syncing a log with [Logtail.com](https://logtail.com):

Note: Differs from the `Middleware` type because it receives - and resolves to a Promise of - an array of batched `ILogtailLog`.

```typescript
Sync = (logs: ILogtailLog[]) => Promise<ILogtailLog[]>
```

## LICENSE

[ISC](LICENSE.md)
