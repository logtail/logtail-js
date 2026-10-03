import { logtailTransport } from "./pino";
import { LogtailStream } from "./stream";

export default logtailTransport;
export { LogtailStream };
export type { ILogtailStreamOptions } from "./stream";
