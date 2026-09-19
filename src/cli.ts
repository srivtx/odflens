#!/usr/bin/env bun
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { audit } from "./audit";
import { formatJson, formatText } from "./report";
import { writeSarif } from "./sarif";
import type { AuditResult, Severity } from "./types";

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
  --json                Print machine-readable JSON instead of text
  --quiet               Print a single summary line per file
  --sarif <path>        Write a SARIF 2.1.0 report to <path>
  --fail-on <level>     Exit 1 on error, warning, info, or none (default: error)
  --version             Print the odflens version
  -h, --help            Show this help

Exit codes:
  0  no issues at or above --fail-on
  1  at least one issue at or above --fail-on
  2  invalid usage / no input
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

export async function run(argv: string[]): Promise<number> {
  let opts: Options;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
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

  const files = collectFiles(opts);
  if (files.length === 0) {
    console.error(USAGE);
    return 2;
  }

  let failed = false;
  const results: AuditResult[] = [];
  for (const file of files) {
    let data: Uint8Array;
    try {
      data = new Uint8Array(await Bun.file(file).arrayBuffer());
    } catch (err) {
      console.error(`${file}: ${err instanceof Error ? err.message : String(err)}`);
      failed = true;
      continue;
    }

    const result = audit(data, basename(file));
    results.push(result);
    if (hasFailure(result, opts.failOn)) {
      failed = true;
    }

    if (opts.quiet) {
      console.log(
        `${basename(file)}: ${result.counts.error} error(s), ${result.counts.warning} warning(s), ${result.counts.info} info`,
      );
    } else if (opts.json) {
      console.log(formatJson(result));
    } else {
      console.log(formatText(result));
    }
  }

  if (opts.sarif !== null) {
    try {
      await writeSarif(opts.sarif, results, "odflens", VERSION);
    } catch (err) {
      console.error(
        `Could not write SARIF report: ${err instanceof Error ? err.message : String(err)}`,
      );
      return 2;
    }
  }

  return failed ? 1 : 0;
}

if (import.meta.main) {
  const code = await run(process.argv.slice(2));
  process.exit(code);
}
