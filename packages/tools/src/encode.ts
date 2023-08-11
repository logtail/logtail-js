import { ILogtailOptions } from "@logtail/types";

/**
 * Converts a plain-text string to a base64 string
 *
 * @param str - Plain text string -> base64
 */
export function base64Encode(str: string): string {
  return Buffer.from(str).toString("base64");
}

/**
 * Sanitizes context values before serialization
 *
 * @param value - Context value for sanitizing before encoding
 * @param options - Logtail options determining limits and warning behavior
 * @param maxDepth - Depth counter for maxDepth check
 * @param visitedObjects - Visited object map for circularDependency check
 */
export function sanitizeContext(value: any, options: ILogtailOptions, maxDepth?: number, visitedObjects: WeakSet<any> = new WeakSet()): any {
  if (maxDepth === undefined) {
    return sanitizeContext(value, options, options.contextObjectMaxDepth)
  }

  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return value;
  } else if (value instanceof Date) {
    // Date instances can be invalid & toISOString() will fail
    if (isNaN(value.getTime())) {
      return value.toString();
    }

    return value.toISOString();
  } else if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack?.split("\n"),
    };
  } else if ((typeof value === "object" || Array.isArray(value)) && (maxDepth < 1 || visitedObjects.has(value))) {
    if (visitedObjects.has(value)) {
      if (options.contextObjectCircularRefWarn) {
        console.warn(`[Logtail] Found a circular reference when serializing logs. Please do not use circular references in your logs.`);
      }
      return '<omitted circular reference>'
    }
    if (options.contextObjectMaxDepthWarn) {
      console.warn(`[Logtail] Max depth of ${options.contextObjectMaxDepth} reached when serializing logs. Please do not use excessive object depth in your logs.`);
    }
    return `<omitted context beyond configured max depth: ${options.contextObjectMaxDepth}>`
  } else if (Array.isArray(value)) {
    visitedObjects.add(value);
    const sanitizedArray = value.map((item) => sanitizeContext(item, options, maxDepth-1, visitedObjects));
    visitedObjects.delete(value);

    return sanitizedArray
  } else if (typeof value === "object") {
    const logClone: { [key: string]: any } = {};

    visitedObjects.add(value);

    Object.entries(value).forEach(item => {
      const key = item[0];
      const value = item[1];

      const result = sanitizeContext(value, options, maxDepth-1, visitedObjects);
      if (result !== undefined){
        logClone[key] = result;
      }
    });

    visitedObjects.delete(value);

    return logClone;
  } else if (typeof value === 'undefined') {
    return undefined;
  } else {
    return `<omitted unserializable ${typeof value}>`;
  }
}
