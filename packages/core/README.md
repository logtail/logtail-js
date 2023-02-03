# [Logtail](https://betterstack.com/logtail) JavaScript client by [Better Stack](https://betterstack.com/) - Logging core library 

[![ISC License](https://img.shields.io/badge/license-ISC-ff69b4.svg)](LICENSE.md)

**Looking for a logging solution?**  
Check out [Logtail](https://logtail.com) and [Logtail clients for JavaScript and Node.js](https://betterstack.com/docs/logs/javascript/).

## `@logtail/core`

This is an NPM package that provides core logging functionality.

It's used by the [Node](https://github.com/logtail/logtail-js/tree/master/packages/node) and [browser](https://github.com/logtail/logtail-js/tree/master/packages/browser) logging packages.

You typically wouldn't require this package directly, unless you're building a custom logger.

## The `Base` class

The [Base](src/base.ts) class provides core features that are extended by loggers.

For example - you could create a custom logger that implements its own sync method, for getting data over to [Logtail.com](https://logtail.com)

```typescript
import { Base } from "@logtail/core";
import { ILogtailOptions, ILogtailLog } from "@logtail/types";

class CustomLogger extends Base {
  // Constructor must take a Logtail.com source token, and (optional) options
  public constructor(
    sourceToken: string,
    options?: Partial<ILogtailOptions>
  ) {
    // Make sure you pass the source token to the parent constructor!
    super(sourceToken, options);

    // Create a custom sync method
    this.setSync(async (logs: ILogtailLog[]) => {
      // Sync the `log` somehow ... `this._sourceToken` contains your Logtail source token

      // ....

      // Finally, return the log... which will resolve our initial `.log()` call
      return logs;
    });
  }
}
```

## Logging

Logging to Logtail is simple - just call the `.log()` function with a string message:

```typescript
// Simple log message (defaults to the 'info' log level)
logtail.log("Hello Logtail!");

// Or, add custom context keys to pass along with the log
logtail.log("Once more, with context", {
  httpRequest: {
    "user-agent": {
      browser: "Chrome",
    },
  },
});
```

There are four levels of logging, each corresponding to a function:

| Function | Log level                                                                                                  | Example                                                |
| -------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| .debug() | Debug - logs to report/diagnose system events                                                              | Currently logged in session object, during development |
| .info()  | Info - data/events where no action is required; for information only                                       | User successfully logged in                            |
| .warn()  | Warning - advisory messages that something probably needs fixing, but not serious enough to cause an error | SQL query ran slower than expected                     |
| .error() | Error - something went wrong                                                                               | Couldn't connect to database                           |

By default, `.log()` logs at the 'info' level. You can use the above explicit log levels instead by calling the relevant function with your log message.

All log levels return a Promise that will resolve once the log has been synced with [Logtail.com](https://logtail.com):

```typescript
// Will resolve when synced with Logtail.com (or reject if there's an error)
logtail.log("some log message").then((log) => {
  // `log` is the transformed log, after going through middleware
});
```

## Middleware

You can add your own middleware functions, which act as transforms on the _ILogtailLog_ log object.

This is useful for augmenting the log prior to syncing with Logtail, or even pushing the log to another service.

Here's what a middleware function looks like:

```typescript
import { ILogtailLog } from "@logtail/types";

// In this example function, we'll add custom 'context' meta to the log
// representing the currently logged in user.
//
// Note: a middleware function is any function that takes an `ILogtailLog`
// and returns a `Promise<ILogtailLog>`
async function addCurrentUser(log: ILogtailLog): Promise<ILogtailLog> {
  return {
    ...log, // <-- copy the existing log
    user: {
      // ... and add our own `context` data
      id: 1000,
      name: "John",
    },
  };
}
```

Then just attach to the Logtail instance with `.use`:

```typescript
logtail.use(addCurrentUser);
```

You can add any number of pipeline functions to your logger instance, and they'll run in order.

Middleware functions run _before_ the final sync to Logtail.com. Pipeline functions should return a `Promise<ILogtailLog>`, making it possible to augment logs with asynchronous data from external sources.

**Note: If an exception is thrown anywhere in the pipeline chain, the log _won't_ be synced. Wrap an async `try/catch` block around your call to `.log|info|debug|warn|error()` or tack on a `.catch()` to ensure your errors are handled.**

### Removing middleware

If you wish to remove middleware, pass in the original middleware function to `.remove()`:

```typescript
// `addCurrentUser` will no longer be used to transform logs
logtail.remove(addCurrentUser);
```

This will remove the middleware function from _all_ future calls to `.log|info|debug|warn|error()`.

To re-add middleware, pass it to `.use()`

### LICENSE

[ISC](LICENSE.md)
