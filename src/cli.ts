#!/usr/bin/env bun
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { audit } from "./audit";
import { formatJsonResults, formatText } from "./report";
import { writeSarif } from "./sarif";
import type { AuditResult, Issue, Severity } from "./types";

export type FailOn = Severity | "none";

export interface Options {
  json: boolean;
  quiet: boolean;
  dir: string | null;
  help: boolean;
  version: boolean;
  sarif: string | null;
  failOn: FailOn;
  files: string[];
}

export const VERSION: string = (() => {
  try {
    const raw = readFileSync(new URL("../package.json", import.meta.url), "utf8");
    const parsed = JSON.parse(raw) as { version?: unknown };
    return typeof parsed.version === "string" ? parsed.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
})();

export const USAGE = `odflens - offline accessibility auditor for OpenDocument files

Usage:
  odflens <file...> [--json] [--quiet] [--sarif <path>] [--fail-on <level>]
  odflens --dir <path> [--json] [--quiet] [--sarif <path>] [--fail-on <level>]

Options:
  --dir <path>          Audit every .odt/.ods/.odp file in <path> (non-recursive, sorted)
  --json                Print a single JSON array of results to stdout
  --quiet               Print a single summary line per file
  --sarif <path>        Write a SARIF 2.1.0 report to <path>
  --fail-on <level>     Exit 1 on error, warning, info, or none (default: error)
  --version             Print the odflens version
  -h, --help            Show this help

Exit codes:
  0  no findings at or above --fail-on
  1  findings at or above --fail-on
  2  invalid usage, or a document that cannot be read/parsed as ODF
  3  an input file or output report could not be read/written
`;

const EXTENSIONS = [".odt", ".ods", ".odp"];
const FAIL_ON_LEVELS: FailOn[] = ["error", "warning", "info", "none"];
const RANK: Record<Severity, number> = { error: 3, warning: 2, info: 1 };

function failThreshold(failOn: FailOn): number {
  return failOn === "none" ? 0 : RANK[failOn];
}

function hasFailure(result: AuditResult, failOn: FailOn): boolean {
  const threshold = failThreshold(failOn);
  if (threshold === 0) return false;
  for (const severity of Object.keys(RANK) as Severity[]) {
    if (RANK[severity] >= threshold && result.counts[severity] > 0) {
      return true;
    }
  }
  return false;
}

export function parseArgs(argv: string[]): Options {
  const opts: Options = {
    json: false,
    quiet: false,
    dir: null,
    help: false,
    version: false,
    sarif: null,
    failOn: "error",
    files: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") {
      opts.json = true;
    } else if (arg === "--quiet") {
      opts.quiet = true;
    } else if (arg === "--version") {
      opts.version = true;
    } else if (arg === "--dir") {
      const next = argv[++i];
      if (next === undefined) {
        throw new Error("--dir requires a path argument");
      }
      opts.dir = next;
    } else if (arg === "--sarif" || arg?.startsWith("--sarif=")) {
      const inline = arg.startsWith("--sarif=") ? arg.slice("--sarif=".length) : null;
      const value = inline ?? argv[++i];
      if (value === undefined || value === "") {
        throw new Error("--sarif requires a path argument");
      }
      opts.sarif = value;
    } else if (arg === "--fail-on" || arg?.startsWith("--fail-on=")) {
      const inline = arg.startsWith("--fail-on=") ? arg.slice("--fail-on=".length) : null;
      const value = inline ?? argv[++i];
      if (value === undefined) {
        throw new Error("--fail-on requires a level (error, warning, info, none)");
      }
      if (!FAIL_ON_LEVELS.includes(value as FailOn)) {
        throw new Error(`Invalid --fail-on value: ${value}`);
      }
      opts.failOn = value as FailOn;
    } else if (arg === "-h" || arg === "--help") {
      opts.help = true;
    } else if (arg !== undefined && arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (arg !== undefined) {
      opts.files.push(arg);
    }
  }
  return opts;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function collectFiles(opts: Options): string[] {
  const files = [...opts.files];
  if (opts.dir !== null) {
    const entries = readdirSync(opts.dir)
      .filter((name) =>
        EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext)),
      )
      .sort();
    for (const name of entries) {
      files.push(join(opts.dir, name));
    }
  }
  return files;
}

function unreadableResult(file: string, message: string): AuditResult {
  const issue: Issue = {
    code: "ODF-000",
    severity: "error",
    message: `Could not read file: ${message}`,
    location: file,
  };
  return {
    file,
    kind: "odf",
    issues: [issue],
    counts: { error: 1, warning: 0, info: 0 },
    fatal: true,
  };
}

export async function run(argv: string[]): Promise<number> {
  let opts: Options;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    console.error(errorMessage(err));
    console.error(USAGE);
    return 2;
  }

  if (opts.version) {
    console.log(VERSION);
    return 0;
  }

  if (opts.help) {
    console.log(USAGE);
    return 0;
  }

  let files: string[];
  try {
    files = collectFiles(opts);
  } catch (err) {
    console.error(`Could not read directory ${opts.dir}: ${errorMessage(err)}`);
    return 2;
  }

  if (files.length === 0) {
    if (opts.dir !== null) {
      console.error(`No ODF files found in ${opts.dir}`);
      return 0;
    }
    console.error(USAGE);
    return 2;
  }

  let hadFindings = false;
  let hadFatal = false;
  let hadIo = false;
  const results: AuditResult[] = [];

  for (const file of files) {
    let data: Uint8Array;
    try {
      data = new Uint8Array(await Bun.file(file).arrayBuffer());
    } catch (err) {
      const message = errorMessage(err);
      console.error(`${file}: ${message}`);
      hadIo = true;
      const result = unreadableResult(file, message);
      results.push(result);
      if (opts.quiet) {
        console.log(`${basename(file)}: unreadable`);
      }
      continue;
    }

    const result = audit(data, basename(file));
    results.push(result);
    if (result.fatal) {
      hadFatal = true;
    } else if (hasFailure(result, opts.failOn)) {
      hadFindings = true;
    }

    if (opts.quiet) {
      console.log(
        `${basename(file)}: ${result.counts.error} error(s), ${result.counts.warning} warning(s), ${result.counts.info} info`,
      );
    } else if (!opts.json) {
      console.log(formatText(result));
    }
  }

  if (opts.json) {
    console.log(formatJsonResults(results));
  }

  if (opts.sarif !== null) {
    try {
      await writeSarif(opts.sarif, results, "odflens", VERSION);
    } catch (err) {
      console.error(`Could not write SARIF report: ${errorMessage(err)}`);
      return 3;
    }
  }

  if (hadIo) return 3;
  if (hadFatal) return 2;
  if (hadFindings) return 1;
  return 0;
}

if (import.meta.main) {
  const code = await run(process.argv.slice(2));
  process.exit(code);
}
