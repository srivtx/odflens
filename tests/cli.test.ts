import { describe, expect, test } from "bun:test";
import { audit } from "../src/audit";
import { makeBadOdt, makeBadOds, makeGoodOdt } from "../src/fixtures";
import { formatText } from "../src/report";

describe("odf-a11y fixtures", () => {
  test("bad odt reports errors", () => {
    expect(audit(makeBadOdt(), "bad.odt").counts.error).toBeGreaterThan(0);
  });

  test("good odt reports no errors", () => {
    expect(audit(makeGoodOdt(), "good.odt").counts.error).toBe(0);
  });

  test("bad ods is detected as a spreadsheet", () => {
    expect(audit(makeBadOds(), "bad.ods").kind).toBe("ods");
  });

  test("bad odt text report names ODF-ALT-003", () => {
    const output = formatText(audit(makeBadOdt(), "bad.odt"));
    expect(output).toContain("ODF-ALT-003");
  });
});
