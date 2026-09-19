#!/usr/bin/env bun
import { readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { audit } from "./audit";
import { formatJson, formatText } from "./report";

export interface Options {
  json: boolean;
  quiet: boolean;
  dir: string | null;
  help: boolean;
  files: string[];
}

export const USAGE = `odf-a11y - offline accessibility auditor for OpenDocument files

Usage:
  odf-a11y <file...> [--json] [--quiet]
  odf-a11y --dir <path> [--json] [--quiet]

Options:
  --dir <path>   Audit every .odt/.ods/.odp file in <path> (non-recursive, sorted)
  --json         Print machine-readable JSON instead of text
  --quiet        Print a single summary line per file
  -h, --help     Show this help

Exit codes:
  0  no errors
  1  at least one file reported an error
  2  invalid usage / no input
`;

const EXTENSIONS = [".odt", ".ods", ".odp"];

export function parseArgs(argv: string[]): Options {
  const opts: Options = {
    json: false,
    quiet: false,
    dir: null,
    help: false,
    files: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") {
      opts.json = true;
    } else if (arg === "--quiet") {
      opts.quiet = true;
    } else if (arg === "--dir") {
      const next = argv[++i];
      if (next === undefined) {
        throw new Error("--dir requires a path argument");
      }
      opts.dir = next;
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

  if (opts.help) {
    console.log(USAGE);
    return 0;
  }

  const files = collectFiles(opts);
  if (files.length === 0) {
    console.error(USAGE);
    return 2;
  }

  let hadError = false;
  for (const file of files) {
    let data: Uint8Array;
    try {
      data = new Uint8Array(await Bun.file(file).arrayBuffer());
    } catch (err) {
      console.error(`${file}: ${err instanceof Error ? err.message : String(err)}`);
      hadError = true;
      continue;
    }

    const result = audit(data, basename(file));
    if (result.counts.error > 0) {
      hadError = true;
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

  return hadError ? 1 : 0;
}

if (import.meta.main) {
  const code = await run(process.argv.slice(2));
  process.exit(code);
}
