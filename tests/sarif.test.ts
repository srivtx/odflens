import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { audit } from "../src/audit";
import { RULE_CATALOG } from "../src/catalog";
import { makeBadOdt } from "../src/fixtures";
import { toSarif, writeSarif } from "../src/sarif";

describe("toSarif", () => {
  const result = audit(makeBadOdt(), "bad.odt");

  test("emits a SARIF 2.1.0 log with the tool driver", () => {
    const sarif = toSarif(result, "odflens", "0.1.0");
    expect(sarif.version).toBe("2.1.0");
    expect(sarif.$schema).toBe("https://json.schemastore.org/sarif-2.1.0.json");
    expect(sarif.runs[0]!.tool.driver.name).toBe("odflens");
    expect(sarif.runs[0]!.tool.driver.version).toBe("0.1.0");
    expect(sarif.runs[0]!.tool.driver.informationUri).toBe(
      "https://github.com/srivtx/odflens",
    );
    expect(sarif.runs[0]!.tool.driver.rules.length).toBeGreaterThan(0);
  });

  test("accepts an array of results and maps severity to SARIF levels", () => {
    const sarif = toSarif([result], "odflens", "0.1.0");
    const found = sarif.runs[0]!.results.find((r) => r.ruleId === "ODF-LANG-001");
    expect(found).toBeDefined();
    expect(found!.level).toBe("error");
    expect(found!.message.text).toContain("language");
    expect(found!.locations[0]!.physicalLocation.artifactLocation.uri).toBe("bad.odt");
    expect(
      (found!.locations[0]!.physicalLocation as { region?: unknown }).region,
    ).toBeUndefined();
    expect(found!.properties.tags).toContain("accessibility");
  });

  test("advertises the full rule catalog even when nothing fired", () => {
    const sarif = toSarif([], "odflens", "0.1.0");
    const ids = sarif.runs[0]!.tool.driver.rules.map((rule) => rule.id);
    const expected = RULE_CATALOG.map((rule) => rule.code).sort();
    expect(ids).toEqual(expected);
    expect(sarif.runs[0]!.results).toHaveLength(0);
  });

  test("URL-encodes the artifact URI", () => {
    const spaced = audit(makeBadOdt(), "my report.odt");
    const sarif = toSarif(spaced, "odflens", "0.1.0");
    expect(
      sarif.runs[0]!.results[0]!.locations[0]!.physicalLocation.artifactLocation.uri,
    ).toBe("my%20report.odt");
  });

  test("reports unreadable files as ODF-000 results", () => {
    const broken = audit(new Uint8Array([1, 2, 3]), "broken.odt");
    expect(broken.fatal).toBe(true);
    const sarif = toSarif(broken, "odflens", "0.1.0");
    expect(sarif.runs[0]!.results.some((result) => result.ruleId === "ODF-000")).toBe(true);
  });

  test("writeSarif writes a parseable SARIF file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "odflens-sarif-"));
    const path = join(dir, "report.sarif");
    await writeSarif(path, result, "odflens", "0.1.0");
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    expect(parsed.version).toBe("2.1.0");
    expect(parsed.runs[0].tool.driver.name).toBe("odflens");
    expect(parsed.runs[0].results.length).toBeGreaterThan(0);
  });
});
