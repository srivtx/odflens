import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const entry = join(repoRoot, "src", "index.ts");
const outfile = join(repoRoot, "site", "assets", "demo.js");

async function main() {
  if (!existsSync(entry)) {
    process.stdout.write(
      `skipping site demo: ${entry} not found (source is missing)\n`,
    );
    return;
  }

  await mkdir(dirname(outfile), { recursive: true });

  await esbuild.build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2020",
    minify: true,
    globalName: "OdfLens",
    logLevel: "info",
  });

  process.stdout.write(`built site demo -> ${outfile}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error?.stack ?? error}\n`);
  process.exit(1);
});
