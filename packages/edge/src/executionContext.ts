/**
 * The part of Cloudflare's ExecutionContext the logger relies on.
 * Declared here so the published types don't depend on Cloudflare's types package -
 * any context with `waitUntil` fits, whether typed by that package or by `wrangler types`.
 */
export interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
}
