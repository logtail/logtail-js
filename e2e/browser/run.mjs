// Opens example-project/browser/index.html in headless Chrome, the way a customer's page runs, and exits non-zero
// unless the page reports that every log was sent.
//
// The page is served from 127.0.0.1 with its <source_token> and <ingesting_host> placeholders filled in from
// BETTER_STACK_SOURCE_TOKEN and BETTER_STACK_INGESTING_HOST. Its script tag loads @logtail/browser from jsDelivr;
// that request is answered with the bundle installed in the example's node_modules instead, which is the package
// under test (built from this checkout, or the npm release on the schedule).
// Env: EXAMPLE (the example's directory), CHROME (the Chrome executable), BETTER_STACK_SOURCE_TOKEN,
//      BETTER_STACK_INGESTING_HOST.
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const example = fileURLToPath(new URL(`../../${process.env.EXAMPLE}`, import.meta.url));
const bundle = readFileSync(join(example, "node_modules/@logtail/browser/dist/umd/logtail.js"));
const page = readFileSync(join(example, "index.html"), "utf8")
  .replaceAll("<source_token>", process.env.BETTER_STACK_SOURCE_TOKEN)
  .replaceAll("<ingesting_host>", process.env.BETTER_STACK_INGESTING_HOST);

const server = createServer((request, response) => {
  response.writeHead(200, { "Content-Type": "text/html" });
  response.end(page);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true });
let outcome = "the page did not report within 60 s";
try {
  const tab = await browser.newPage();
  console.log(`Chrome ${browser.version()}`);
  let bundleServed = false;
  await tab.route("https://cdn.jsdelivr.net/npm/@logtail/browser@*/dist/umd/logtail.js", (route) => {
    bundleServed = true;
    route.fulfill({ status: 200, contentType: "application/javascript", body: bundle });
  });
  // The page reports on the console, like the other examples on stdout.
  const reported = new Promise((resolve) => {
    tab.on("console", (message) => {
      console.log(`[page ${message.type()}] ${message.text()}`);
      if (message.text().startsWith("All done!")) resolve("");
      if (message.text().startsWith("Not all logs have been synced!")) resolve(message.text());
    });
    tab.on("pageerror", (error) => resolve(`the page threw ${error.message}`));
  });
  await tab.goto(`http://127.0.0.1:${server.address().port}/`);
  outcome = await Promise.race([reported, new Promise((resolve) => setTimeout(() => resolve(outcome), 60000))]);
  if (!bundleServed) outcome = "the page did not load @logtail/browser from the jsDelivr URL this test answers";
} finally {
  await browser.close();
  server.close();
}

if (outcome) {
  console.error(`Error: ${outcome}`);
  process.exit(1);
}
