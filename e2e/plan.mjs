// Prints the job matrix of the E2E workflow (.github/workflows/e2e.yml) as JSON: {"matrix": [...], "reject": {...}}.
//
//   node e2e/plan.mjs [--leg all|floor|latest|canary] [--flavour all|<flavour>] [--source checkout|npm]
//                     [--node <exact>] [--bun <exact>] [--library <exact>]
//
// One job per leg and flavour. A flavour is one example project under example-project/, run on one runtime:
//   node, bun                 example-project/node (@logtail/js) on Node.js, and on Bun
//   winston, pino, bunyan     example-project/<flavour> on Node.js with that logging library
//   koa                       example-project/koa, a Koa app serving one request
//   browser                   example-project/browser, a page loading @logtail/browser in headless Chrome
//   edge                      example-project/edge, a Cloudflare Worker using @logtail/edge under wrangler dev
// The legs:
//   floor   Node.js 18 and Bun 1.0 (no package declares engines, these are the oldest the README promises), and the
//           oldest library version each integration's peerDependencies allow. browser and edge have no floor.
//   latest  the newest Node.js release (setup-node's "latest" would pick a pre-release such as 27.0.0-alpha, so the
//           exact version comes from nodejs.org), Bun's newest release, each library's npm latest, Chrome's Stable
//           channel, and wrangler's npm latest with the workerd it pins. The job fails unless exactly these run.
//   canary  the newest Node.js nightly, Bun canary, each library's npm next when it is newer than latest, Chrome
//           Canary, and wrangler's latest running the Worker with the newest compatibility date its workerd supports.
// --node, --bun and --library replace the planned version of every job they apply to, which is how a run bisects a
// failure to one release. --source is copied into every entry: checkout installs the packages built from this
// checkout, npm their newest releases. "reject" is the one extra job that runs the node example with an invalid
// source token on the latest leg, and must fail.
//
// No dependencies, so the plan job needs nothing but Node.js.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const LEGS = ["floor", "latest", "canary"];
export const FLAVOURS = ["node", "bun", "winston", "pino", "bunyan", "koa", "browser", "edge"];
// The integrations whose library is a peer dependency, and the package declaring it.
export const LIBRARIES = { winston: "winston", pino: "pino", bunyan: "bunyan", koa: "koa" };
const FLOOR_NODE_MAJOR = "18";
const FLOOR_BUN_MINOR = "1.0";
// NPM_REGISTRY points the lookups at a mirror, for machines that cannot reach registry.npmjs.org.
const NPM_REGISTRY = process.env.NPM_REGISTRY || "https://registry.npmjs.org";
// Job names become artifact names (e2e-summary-<job name>), which must not contain any of these.
const NOT_IN_NAMES = ':"<>|*?/\\';

// "1.2.3" or "1.2.3-rc.1" as [1, 2, 3, prerelease]: a version without prerelease sorts after one with.
function parse(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/.exec(version);
  if (!match) throw new Error(`not a version: ${version}`);
  return [Number(match[1]), Number(match[2]), Number(match[3]), match[4] ?? null];
}

export function compareVersions(a, b) {
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  if (x[3] === y[3]) return 0;
  if (x[3] === null) return 1;
  if (y[3] === null) return -1;
  return x[3] < y[3] ? -1 : 1;
}

// The lowest version a peer dependency range allows: ">=3.2.1" is 3.2.1, "^7.0.0 || ^8.0.0" is 7.0.0.
export function rangeFloor(range) {
  const floors = range.split("||").map((alternative) => {
    const match = /^\s*(?:\^|~|>=|=)?\s*v?(\d+)(?:\.(\d+))?(?:\.(\d+))?\s*(?:$|<)/.exec(alternative);
    if (!match) throw new Error(`cannot tell the lowest version of the range "${range}"`);
    return `${match[1]}.${match[2] ?? 0}.${match[3] ?? 0}`;
  });
  return floors.sort(compareVersions)[0];
}

// The newest stable release in nodejs.org's index, and the newest of one major line.
export function newestNode(index, major) {
  const releases = index.map((entry) => entry.version.slice(1)).filter((version) => !version.includes("-"));
  const line = major ? releases.filter((version) => version.startsWith(`${major}.`)) : releases;
  if (line.length === 0) throw new Error(`nodejs.org lists no Node.js ${major ?? ""} release`);
  return line.sort(compareVersions).at(-1);
}

// The newest nightly build that has a Linux x64 download, which is what setup-node installs.
export function newestNightly(index) {
  const entry = index.find((build) => build.files.includes("linux-x64"));
  if (!entry) throw new Error("nodejs.org lists no Linux x64 nightly build");
  return entry.version.slice(1);
}

// The newest release of a minor line in an npm packument, e.g. Bun 1.0.36 for "1.0".
export function newestOfMinor(packument, minor) {
  const versions = Object.keys(packument.versions).filter(
    (version) => version.startsWith(`${minor}.`) && !version.includes("-"),
  );
  if (versions.length === 0) throw new Error(`npm lists no ${packument.name} ${minor}.x release`);
  return versions.sort(compareVersions).at(-1);
}

// npm's next dist-tag when it is ahead of latest (a pre-release line), otherwise latest.
export function canaryRelease(packument) {
  const { latest, next } = packument["dist-tags"];
  return next && compareVersions(next, latest) > 0 ? next : latest;
}

// workerd versions are 1.<date>.<n>, the date being the newest compatibility date it supports.
export function workerdDate(workerd) {
  const match = /^\d+\.(\d{4})(\d{2})(\d{2})\.\d+$/.exec(workerd);
  if (!match) throw new Error(`cannot read a date from workerd ${workerd}`);
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function jobName(job) {
  const versions =
    {
      node: `Node ${job.node}`,
      bun: `Bun ${job.bun}`,
      browser: `Chrome ${job.chrome}`,
      edge: `wrangler ${job.wrangler}, workerd ${job.workerd}, compatibility date ${job.compatibility_date}`,
    }[job.flavour] ?? `Node ${job.node}, ${job.library} ${job.library_version}`;
  const name = `${job.leg} ${job.flavour} (${versions})`;
  if ([...name].some((char) => NOT_IN_NAMES.includes(char))) {
    throw new Error(`job name "${name}" contains one of ${NOT_IN_NAMES}, which artifact names do not allow`);
  }
  return name;
}

// Everything the plan reads from the network, fetched once each.
export function makeSources(fetchJson) {
  const cache = new Map();
  const get = (url) => {
    if (!cache.has(url)) cache.set(url, fetchJson(url));
    return cache.get(url);
  };
  return {
    nodeIndex: () => get("https://nodejs.org/dist/index.json"),
    nightlyIndex: () => get("https://nodejs.org/download/nightly/index.json"),
    packument: (name) => get(`${NPM_REGISTRY}/${name.replace("/", "%2F")}`),
    chrome: () => get("https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json"),
  };
}

export async function planJob(leg, flavour, sources, { source = "checkout", node = "", bun = "", library = "" } = {}) {
  if (!["checkout", "npm"].includes(source)) throw new Error(`unknown source ${source}`);
  if ((flavour === "browser" || flavour === "edge") && leg === "floor") return null;
  const job = {
    leg,
    flavour,
    // The example's own directory: the bun flavour runs the node example.
    example: `example-project/${flavour === "bun" ? "node" : flavour}`,
    source,
    // The floor runs on the oldest Ubuntu image GitHub offers, the other legs follow ubuntu-latest.
    runner: leg === "floor" ? "ubuntu-24.04" : "ubuntu-latest",
    // Node.js runs the example, or for bun, browser and edge only npm and the tools: then the newest release.
    node: newestNode(await sources.nodeIndex()),
    bun: "",
    library: "",
    library_version: "",
    chrome: "",
    wrangler: "",
    workerd: "",
    compatibility_date: "",
  };
  const runsOnNode = !["bun", "browser", "edge"].includes(flavour);
  if (runsOnNode) {
    if (leg === "floor") job.node = newestNode(await sources.nodeIndex(), FLOOR_NODE_MAJOR);
    if (leg === "canary") job.node = newestNightly(await sources.nightlyIndex());
    job.node = node || job.node;
  }
  if (flavour === "bun") {
    const packument = await sources.packument("bun");
    job.bun =
      bun ||
      {
        floor: () => newestOfMinor(packument, FLOOR_BUN_MINOR),
        latest: () => packument["dist-tags"].latest,
        canary: () => "canary",
      }[leg]();
  }
  if (LIBRARIES[flavour]) {
    job.library = LIBRARIES[flavour];
    const manifest = JSON.parse(readFileSync(new URL(`../packages/${flavour}/package.json`, import.meta.url)));
    const peer = manifest.peerDependencies?.[job.library];
    if (!peer) throw new Error(`packages/${flavour}/package.json declares no peer dependency on ${job.library}`);
    const packument = leg === "floor" ? null : await sources.packument(job.library);
    job.library_version =
      library ||
      (leg === "floor"
        ? rangeFloor(peer)
        : leg === "latest"
          ? packument["dist-tags"].latest
          : canaryRelease(packument));
  }
  if (flavour === "browser") {
    job.chrome = (await sources.chrome()).channels[leg === "latest" ? "Stable" : "Canary"].version;
  }
  if (flavour === "edge") {
    const packument = await sources.packument("wrangler");
    job.wrangler = packument["dist-tags"].latest;
    job.workerd = packument.versions[job.wrangler].dependencies.workerd;
    // latest runs the Worker as wrangler.jsonc configures it, canary with the newest defaults its workerd has.
    const config = readFileSync(new URL(`../${job.example}/wrangler.jsonc`, import.meta.url), "utf8");
    const configured = /"compatibility_date"\s*:\s*"([^"]+)"/.exec(config)?.[1];
    if (!configured) throw new Error(`${job.example}/wrangler.jsonc sets no compatibility_date`);
    job.compatibility_date = leg === "latest" ? configured : workerdDate(job.workerd);
  }
  job.name = jobName(job);
  return job;
}

export async function plan({ leg = "all", flavour = "all", ...options }, sources) {
  const legs = leg === "all" ? LEGS : [leg];
  const flavours = flavour === "all" ? FLAVOURS : [flavour];
  for (const value of legs) if (!LEGS.includes(value)) throw new Error(`unknown leg ${value}`);
  for (const value of flavours) if (!FLAVOURS.includes(value)) throw new Error(`unknown flavour ${value}`);
  const matrix = [];
  for (const l of legs) for (const f of flavours) matrix.push(await planJob(l, f, sources, options));
  // The invalid token check runs once, with the node example on the latest leg.
  let reject = null;
  if (legs.includes("latest") && flavours.includes("node")) {
    const node = matrix.find((job) => job && job.leg === "latest" && job.flavour === "node");
    reject = { ...node, name: `latest node rejected (Node ${node.node}, invalid source token)` };
  }
  return { matrix: matrix.filter(Boolean), reject };
}

// A registry hiccup at schedule time should not file a Linear issue, so every lookup is retried.
async function fetchJson(url, attempts = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (attempt === attempts) throw new Error(`GET ${url} failed ${attempts} times, last: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: {
      leg: { type: "string", default: "all" },
      flavour: { type: "string", default: "all" },
      source: { type: "string", default: "checkout" },
      node: { type: "string", default: "" },
      bun: { type: "string", default: "" },
      library: { type: "string", default: "" },
    },
  });
  const trimmed = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]));
  try {
    console.log(JSON.stringify(await plan(trimmed, makeSources(fetchJson))));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
