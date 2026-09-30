import { readdirSync, readFileSync } from "fs";
import { isBuiltin } from "module";
import { join } from "path";

describe("dependencies", () => {
  it("are all imported by published sources", () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf8"));
    const sources = readdirSync(join(__dirname, "src"))
      .filter((file) => !file.endsWith(".test.ts"))
      .map((file) => readFileSync(join(__dirname, "src", file), "utf8"));

    // This package has no dependencies so far
    const unused = Object.keys(pkg.dependencies ?? {}).filter(
      (name) => !sources.some((source) => source.includes(`"${name}"`)),
    );

    expect(unused).toEqual([]);
  });

  it("include every module imported by published sources", () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf8"));
    const declared = Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies });
    const imported = readdirSync(join(__dirname, "src"))
      .filter((file) => !file.endsWith(".test.ts"))
      .map((file) => readFileSync(join(__dirname, "src", file), "utf8"))
      .join("\n")
      .split(' from "')
      .slice(1)
      .map((rest) => rest.slice(0, rest.indexOf('"')));

    const undeclared = imported.filter((name) => !name.startsWith(".") && !isBuiltin(name) && !declared.includes(name));

    expect(undeclared).toEqual([]);
  });
});
