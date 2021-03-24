import Queue from "./queue";

describe("queue tests", () => {
  it("should store correct number of items in queue", () => {
    const q = new Queue();
    const numberOfItems = 10;

    for (let i = 0; i < numberOfItems; i++) {
      q.push(i);
    }

    expect(q.length).toEqual(numberOfItems);
  });

  it("should retrieve the items in FIFO order", () => {
    const q = new Queue();
    const numberOfItems = 10;
    const list = [];

    // Insert items to both the array and queue
    for (let i = 0; i < numberOfItems; i++) {
      list.push(i);
      q.push(i);
    }

    // Map over plain array (which is ordered), and test
    // against the values from the queue
    list.forEach(item => {
      expect(q.shift()).toEqual(item);
    });

    // Queue should now be empty
    expect(q.length).toEqual(0);
  });

  it("should handle 100,000 items", () => {
    const q = new Queue();
    const numberOfItems = 100000;

    for (let i = 0; i < numberOfItems; i++) {
      q.push(i);
    }

    expect(q.length).toEqual(numberOfItems);
  });

  it("should return undefined if queue is empty", () => {
    const q = new Queue();

    expect(q.shift()).toEqual(undefined);
  });
});
