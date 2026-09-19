import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

function read(relative: string): string {
  return readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");
}

describe("P1-9: package metadata", () => {
  const pkg = JSON.parse(read("package.json"));

  test("TypeScript is a devDependency, not a peerDependency", () => {
    expect(pkg.devDependencies?.typescript).toBeDefined();
    expect(pkg.peerDependencies).toBeUndefined();
  });

  test("the exports map exposes types and an import entry", () => {
    expect(pkg.types).toBe("./src/index.ts");
    expect(pkg.exports["."].types).toBe("./src/index.ts");
    expect(pkg.exports["."].import).toBe("./src/index.ts");
  });

  test("an author is declared", () => {
    expect(typeof pkg.author).toBe("string");
    expect(pkg.author.length).toBeGreaterThan(0);
  });
});

describe("P1-10 / P1-11: documentation is factual and current", () => {
  const readme = read("README.md");
  const changelog = read("CHANGELOG.md");
  const coc = read("CODE_OF_CONDUCT.md");

  test("no claim that OpenDocument is mandated by EN 301 549 / WAD", () => {
    expect(readme).not.toContain("OpenDocument is a mandated format");
    expect(readme).not.toMatch(/ODF[^.]{0,40}mandated/i);
  });

  test("no false claim that ODS/ODP coverage is a subset of ODT", () => {
    expect(readme).not.toContain("coverage is a subset of the ODT");
  });

  test("the docs do not point at example.com placeholders", () => {
    expect(changelog).not.toContain("github.com/example/");
    expect(coc).not.toContain("maintainers@example.com");
  });

  test("the test badge is not stale", () => {
    expect(readme).not.toContain("tests-6-");
  });

  test("the dev instructions generate fixtures first", () => {
    expect(readme).toContain("bun run make-fixtures");
  });
});

describe("P1-13: CI keeps the site assets in sync", () => {
  const workflow = read(".github/workflows/ci.yml");

  test("CI rebuilds the site bundle and checks for drift", () => {
    expect(workflow).toContain("bun run build:site");
    expect(workflow).toContain("git diff --exit-code site/assets/demo.js");
    expect(workflow).toContain("bun run check:site");
  });
});
