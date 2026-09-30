import { readdirSync, readFileSync } from "fs";
import { join } from "path";

describe("dependencies", () => {
  it("are all imported by published sources", () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf8"));
    const sources = readdirSync(join(__dirname, "src"))
      .filter((file) => !file.endsWith(".test.ts"))
      .map((file) => readFileSync(join(__dirname, "src", file), "utf8"));

    // A @types package counts as imported when the module it describes is
    const unused = Object.keys(pkg.dependencies).filter(
      (name) => !sources.some((source) => source.includes(`"${name.replace("@types/", "")}"`)),
    );

    expect(unused).toEqual([]);
  });
});
