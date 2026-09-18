import { readdirSync, readFileSync } from "fs";
import { join } from "path";

describe("@cloudflare/workers-types coupling", () => {
  it("is not forced on consumers by package.json", () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf8"));

    expect(pkg).not.toHaveProperty("peerDependencies");
    expect(pkg.dependencies).not.toHaveProperty("@cloudflare/workers-types");
  });

  it("is not imported by published sources", () => {
    const importers = readdirSync(join(__dirname, "src"))
      .filter((file) => !file.endsWith(".test.ts"))
      .filter((file) => readFileSync(join(__dirname, "src", file), "utf8").includes("@cloudflare/workers-types"));

    expect(importers).toEqual([]);
  });
});
