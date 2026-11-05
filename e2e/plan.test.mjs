// Tests of e2e/plan.mjs: node --test e2e/
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canaryRelease,
  compareVersions,
  canaryNode,
  newestNode,
  newestOfMinor,
  plan,
  rangeFloor,
  workerdDate,
} from "./plan.mjs";

const NODE_INDEX = [
  { version: "v27.0.0-alpha.0.0.0", files: ["linux-x64"] },
  { version: "v26.13.0", files: ["linux-x64"] },
  { version: "v26.12.1", files: ["linux-x64"] },
  { version: "v18.20.8", files: ["linux-x64"] },
  { version: "v18.9.1", files: ["linux-x64"] },
];
const RC_INDEX = [
  { version: "v26.4.0-rc.0", files: ["headers", "src"] },
  { version: "v26.1.0-rc.0", files: ["linux-x64"] },
];
const RC_INDEX_AHEAD = [
  { version: "v28.0.0-rc.1", files: ["headers", "src"] },
  { version: "v27.0.0-rc.2", files: ["linux-x64"] },
  { version: "v27.0.0-rc.10", files: ["linux-x64"] },
  ...RC_INDEX,
];
const PACKUMENTS = {
  bun: {
    name: "bun",
    "dist-tags": { latest: "1.4.4", canary: "1.4.4-canary.20261105.1" },
    versions: { "1.0.0": {}, "1.0.36": {}, "1.0.4": {}, "1.4.4": {} },
  },
  winston: { name: "winston", "dist-tags": { latest: "3.19.0", next: "3.9.0" }, versions: {} },
  pino: { name: "pino", "dist-tags": { latest: "10.4.0", next: "11.0.0-rc.1" }, versions: {} },
  bunyan: { name: "bunyan", "dist-tags": { latest: "1.8.15", beta: "2.0.5" }, versions: {} },
  koa: { name: "koa", "dist-tags": { latest: "3.3.0", next: "2.16.3" }, versions: {} },
  wrangler: {
    name: "wrangler",
    "dist-tags": { latest: "4.158.0" },
    versions: { "4.158.0": { dependencies: { workerd: "1.20261104.1" } } },
  },
};
const CHROME = { channels: { Stable: { version: "157.0.8103.38" }, Canary: { version: "159.0.8144.0" } } };
const sources = {
  nodeIndex: async () => NODE_INDEX,
  rcIndex: async () => RC_INDEX,
  packument: async (name) => PACKUMENTS[name],
  chrome: async () => CHROME,
};

test("compareVersions sorts numerically, a release after its pre-releases", () => {
  assert.deepEqual(["1.10.0", "1.9.0", "1.10.0-rc.10", "1.10.0-rc.2", "1.2.3"].sort(compareVersions), [
    "1.2.3",
    "1.9.0",
    "1.10.0-rc.2",
    "1.10.0-rc.10",
    "1.10.0",
  ]);
});

test("rangeFloor is the lowest version a peer range allows", () => {
  assert.equal(rangeFloor(">=3.2.1"), "3.2.1");
  assert.equal(rangeFloor("^7.0.0 || ^8.0.0 || ^9.0.0 || ^10.0.0"), "7.0.0");
  assert.equal(rangeFloor("^10 || ^8.1"), "8.1.0");
  assert.equal(rangeFloor(">=2.8.1 <4"), "2.8.1");
  assert.throws(() => rangeFloor("*"), /cannot tell the lowest version of the range "\*"/);
});

test("newestNode skips pre-releases and picks the newest of a major line", () => {
  assert.equal(newestNode(NODE_INDEX), "26.13.0");
  assert.equal(newestNode(NODE_INDEX, "18"), "18.20.8");
  assert.throws(() => newestNode(NODE_INDEX, "16"), /lists no Node.js 16 release/);
});

test("canaryNode is the newest release candidate with a Linux x64 download when it is ahead of the newest release", () => {
  assert.equal(canaryNode(RC_INDEX_AHEAD, NODE_INDEX), "27.0.0-rc.10");
});

test("canaryNode is the newest release when no release candidate is ahead of it", () => {
  assert.equal(canaryNode(RC_INDEX, NODE_INDEX), "26.13.0");
  assert.equal(canaryNode([], NODE_INDEX), "26.13.0");
});

test("newestOfMinor picks the newest release of a minor line", () => {
  assert.equal(newestOfMinor(PACKUMENTS.bun, "1.0"), "1.0.36");
});

test("canaryRelease takes next only when it is ahead of latest", () => {
  assert.equal(canaryRelease(PACKUMENTS.pino), "11.0.0-rc.1");
  assert.equal(canaryRelease(PACKUMENTS.winston), "3.19.0");
  assert.equal(canaryRelease(PACKUMENTS.bunyan), "1.8.15");
});

test("workerdDate reads the compatibility date from a workerd version", () => {
  assert.equal(workerdDate("1.20261104.1"), "2026-11-04");
});

test("every leg and flavour, with the reject job", async () => {
  const { matrix, reject } = await plan({}, sources);
  assert.deepEqual(
    matrix.map((job) => job.name),
    [
      "floor node (Node 18.20.8)",
      "floor bun (Bun 1.0.36)",
      "floor winston (Node 18.20.8, winston 3.2.1)",
      "floor pino (Node 18.20.8, pino 7.9.2)",
      "floor bunyan (Node 18.20.8, bunyan 1.8.12)",
      "floor koa (Node 18.20.8, koa 2.8.1)",
      "latest node (Node 26.13.0)",
      "latest bun (Bun 1.4.4)",
      "latest winston (Node 26.13.0, winston 3.19.0)",
      "latest pino (Node 26.13.0, pino 10.4.0)",
      "latest bunyan (Node 26.13.0, bunyan 1.8.15)",
      "latest koa (Node 26.13.0, koa 3.3.0)",
      "latest browser (Chrome 157.0.8103.38)",
      "latest edge (wrangler 4.158.0, workerd 1.20261104.1, compatibility date 2026-11-01)",
      "canary node (Node 26.13.0)",
      "canary bun (Bun canary)",
      "canary winston (Node 26.13.0, winston 3.19.0)",
      "canary pino (Node 26.13.0, pino 11.0.0-rc.1)",
      "canary bunyan (Node 26.13.0, bunyan 1.8.15)",
      "canary koa (Node 26.13.0, koa 3.3.0)",
      "canary browser (Chrome 159.0.8144.0)",
      "canary edge (wrangler 4.158.0, workerd 1.20261104.1, compatibility date 2026-11-04)",
    ],
  );
  assert.equal(reject.name, "latest node rejected (Node 26.13.0, invalid source token)");
  assert.equal(reject.node, "26.13.0");
});

test("one job carries everything the test job reads", async () => {
  const { matrix } = await plan({ leg: "floor", flavour: "pino", source: "npm" }, sources);
  assert.deepEqual(matrix, [
    {
      leg: "floor",
      flavour: "pino",
      example: "example-project/pino",
      source: "npm",
      runner: "ubuntu-24.04",
      node: "18.20.8",
      bun: "",
      library: "pino",
      library_version: "7.9.2",
      chrome: "",
      wrangler: "",
      workerd: "",
      compatibility_date: "",
      name: "floor pino (Node 18.20.8, pino 7.9.2)",
    },
  ]);
});

test("the bun, browser and edge jobs run their tools on the newest Node.js release", async () => {
  const { matrix } = await plan({ leg: "canary", flavour: "bun" }, sources);
  assert.equal(matrix[0].node, "26.13.0");
  assert.equal(matrix[0].example, "example-project/node");
  assert.equal(matrix[0].bun, "canary");
});

test("browser and edge have no floor leg", async () => {
  assert.deepEqual((await plan({ leg: "floor", flavour: "browser" }, sources)).matrix, []);
  assert.deepEqual((await plan({ leg: "floor", flavour: "edge" }, sources)).matrix, []);
});

test("exact versions replace the planned ones where they apply", async () => {
  const { matrix } = await plan({ leg: "latest", node: "22.11.0", bun: "1.2.0", library: "3.10.0" }, sources);
  const byFlavour = Object.fromEntries(matrix.map((job) => [job.flavour, job]));
  assert.equal(byFlavour.winston.name, "latest winston (Node 22.11.0, winston 3.10.0)");
  assert.equal(byFlavour.bun.name, "latest bun (Bun 1.2.0)");
  assert.equal(byFlavour.browser.node, "26.13.0");
});

test("the reject job is planned only with the latest leg and the node flavour", async () => {
  assert.equal((await plan({ leg: "floor" }, sources)).reject, null);
  assert.equal((await plan({ flavour: "pino" }, sources)).reject, null);
});

test("unknown legs, flavours and sources fail", async () => {
  await assert.rejects(plan({ leg: "nightly" }, sources), /unknown leg nightly/);
  await assert.rejects(plan({ flavour: "deno" }, sources), /unknown flavour deno/);
  await assert.rejects(plan({ source: "pypi" }, sources), /unknown source pypi/);
});
