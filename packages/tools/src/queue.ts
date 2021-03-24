import { IQueue } from "./types";

/**
 * Queue, for FIFO access to arbitrary objects. Intended to be a faster
 * replacement for a Javascript array.
 */
export default class Queue<T> {
  /**
   * First node in the tree
   */

  private first?: IQueue<T>;
  /**
   * Last node in the tree
   */
  private last?: IQueue<T>;

  /**
   * Number of items in the queue
   */
  public length = 0;

  /**
   * Pushes a value into the queue.
   * @param value - Any object to push into the queue
   */
  public push(value: any) {
    const node = { value };
    this.last = this.last ? (this.last.next = node) : (this.first = node);
    this.length++;
  }

  /**
   * Remove a value from the start of the queue (FIFO) and return it
   */
  public shift() {
    if (this.first) {
      const { value } = this.first;
      this.first = this.first.next;
      if (!--this.length) {
        this.last = undefined;
      }
      return value;
    }
  }
}
