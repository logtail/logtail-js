/**
 * Internal queue type
 */
export interface IQueue<T> {
  /**
   * Value of queue should be an object
   */
  value: T;
  /**
   * Leaf node in queue, representing the next value
   */
  next?: IQueue<T>;
}

/**
 * Infer arguments based on the Promise return value
 */

export type InferArgs<T> = T extends (...args: any[]) => Promise<infer U>
  ? U
  : void;
