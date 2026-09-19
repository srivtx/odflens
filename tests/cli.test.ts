import { describe, expect, spyOn, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zipSync } from "fflate";
import { audit } from "../src/audit";
import { run } from "../src/cli";
import { makeBadOdt, makeBadOds, makeGoodOdt, makeGoodOdp, makeGoodOds } from "../src/fixtures";
import { formatText } from "../src/report";

const workDir = mkdtempSync(join(tmpdir(), "odflens-cli-"));

function writeFile(name: string, data: Uint8Array | string): string {
  const path = join(workDir, name);
  writeFileSync(path, data);
  return path;
}

async function runCapture(
  argv: string[],
): Promise<{ code: number; out: string; err: string }> {
  const out: string[] = [];
  const err: string[] = [];
  const logSpy = spyOn(console, "log").mockImplementation((...args: any[]) => {
    out.push(args.map(String).join(" "));
  });
  const errSpy = spyOn(console, "error").mockImplementation((...args: any[]) => {
    err.push(args.map(String).join(" "));
  });
  try {
    const code = await run(argv);
    return { code, out: out.join("\n"), err: err.join("\n") };
  } finally {
    logSpy.mockRestore();
    errSpy.mockRestore();
  }
}

describe("odflens fixtures", () => {
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

describe("P0-1: unreadable documents fail the CLI", () => {
  test("a non-zip input exits 2", async () => {
    const path = writeFile("garbage.odt", "definitely not a zip");
    expect(await runCapture([path])).toMatchObject({ code: 2 });
  });

  test("an empty zip exits 2", async () => {
    const path = writeFile("empty.odt", zipSync({}));
    expect(await runCapture([path])).toMatchObject({ code: 2 });
  });
});

describe("P1-4: --json emits one array", () => {
  test("two files produce a single valid JSON array", async () => {
    const a = writeFile("a.odt", makeBadOdt());
    const b = writeFile("b.odt", makeGoodOdt());
    const { code, out } = await runCapture(["--json", a, b]);
    const parsed = JSON.parse(out);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
    expect(code).toBe(1);
  });
});

describe("P1-5: --dir handling", () => {
  test("a missing directory exits 2 with a clean message", async () => {
    const { code, err } = await runCapture(["--dir", join(workDir, "nope")]);
    expect(code).toBe(2);
    expect(err).toContain("Could not read directory");
    expect(err).not.toContain("Usage:");
  });

  test("an empty directory exits 0 and says no ODF files were found", async () => {
    const empty = mkdtempSync(join(tmpdir(), "odflens-empty-"));
    const { code, err } = await runCapture(["--dir", empty]);
    expect(code).toBe(0);
    expect(err).toContain("No ODF files found");
  });
});

describe("P1-6: exit-code semantics", () => {
  test("a missing input file exits 3 even with --fail-on none", async () => {
    const { code } = await runCapture(["--fail-on", "none", join(workDir, "missing.odt")]);
    expect(code).toBe(3);
  });

  test("findings do not fail when --fail-on none", async () => {
    const path = writeFile("findings.odt", makeBadOdt());
    const { code } = await runCapture(["--fail-on", "none", path]);
    expect(code).toBe(0);
  });

  test("a fatal parse still exits 2 with --fail-on none", async () => {
    const path = writeFile("fatal.odt", "not a zip");
    const { code } = await runCapture(["--fail-on", "none", path]);
    expect(code).toBe(2);
  });

  test("a directory of valid ODT/ODS/ODP exits 0", async () => {
    const dir = mkdtempSync(join(tmpdir(), "odflens-valid-"));
    writeFileSync(join(dir, "good.odt"), makeGoodOdt());
    writeFileSync(join(dir, "good.ods"), makeGoodOds());
    writeFileSync(join(dir, "good.odp"), makeGoodOdp());
    const { code } = await runCapture(["--dir", dir]);
    expect(code).toBe(0);
  });
});
