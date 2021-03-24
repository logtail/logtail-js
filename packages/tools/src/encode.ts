/**
 * Converts a plain-text string to a base64 string
 *
 * @param str - Plain text string -> base64
 */
export function base64Encode(str: string): string {
  return Buffer.from(str).toString("base64");
}
