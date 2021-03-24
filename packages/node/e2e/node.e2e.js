const { Node: Logtail } = require("../dist/cjs/node");

// Init Node logging lib
const logtail = new Logtail(process.env.LOGTAIL_ACCESS_TOKEN, {
  endpoint: process.env.LOGTAIL_ENDPOINT,
  batchSize: 1000,
  syncMax: 50,
});

// Build a collection of 10,000 log messages
const messages = [...Array(10000).keys()].map((i) => `Log ${i}`);

// Await syncing to Logtail.com
const postAll = () => messages.map((msg) => logtail.info(msg));
measure(postAll);

function measure(postAll) {
  const logLabel = "Node logging";
  console.time(logLabel);
  Promise.all(postAll()).then(() => console.timeEnd(logLabel));
}
