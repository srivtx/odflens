<div align="center">

# odflens

> Check OpenDocument files. Skip LibreOffice.

**Offline accessibility audit for OpenDocument files (ODT / ODS / ODP).**

[![CI](https://github.com/srivtx/odflens/actions/workflows/ci.yml/badge.svg)](https://github.com/srivtx/odflens/actions/workflows/ci.yml)
[![release](https://img.shields.io/github/v/release/srivtx/odflens?sort=semver&color=4f46e5)](https://github.com/srivtx/odflens/releases)
[![license](https://img.shields.io/badge/license-MIT-0f766e)](LICENSE)
[![runtime](https://img.shields.io/badge/runtime-Bun-14151A?logo=bun&logoColor=white)](https://bun.sh)
[![types](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](tsconfig.json)
[![tests](https://img.shields.io/badge/tests-46-0f766e)](#testing)
[![network](https://img.shields.io/badge/network-none-0f766e)](#privacy)

</div>

---

**Live site:** [odflens](https://odflens-srivtx.vercel.app)  ·  **Playground:** [https://odflens-srivtx.vercel.app/#playground](https://odflens-srivtx.vercel.app/#playground)  ·  **Source:** [github.com/srivtx/odflens](https://github.com/srivtx/odflens)

## Website

Product site with an embedded, fully client-side playground: a real `.odt` /
`.ods` / `.odp` file is unzipped and audited in the browser with the same rule
engine as the CLI. Nothing is uploaded.

**Live:** [https://odflens-srivtx.vercel.app](https://odflens-srivtx.vercel.app)

Local preview:

```bash
bun install
bun run build:site   # bundles src/index.ts -> site/assets/demo.js (esbuild, IIFE, OdfLens)
bun run check:site   # verifies links, classes, one h1, lang, and no external requests
npx serve site       # or any static file server, then open http://localhost:3000
```

`site/assets/demo.js` is committed so the site deploys without a build step
(`vercel.json` sets `outputDirectory` to `site`). Re-run `bun run build:site`
after changing `src/`.

## The problem

OpenDocument (ODF) is widely used in EU and public-sector publishing. Public
sector bodies are generally expected to meet accessibility requirements under
the Web Accessibility Directive (which covers public-sector websites and mobile
apps) and to procure accessible ICT under EN 301 549 (a procurement standard).
Neither instrument mandates ODF itself. What is true is that ODF has
effectively **no accessibility tooling**.

- [AccessODF](https://accessodf.sourceforge.net/) is the only real ODF
  accessibility checker. It is a **LibreOffice GUI extension**, written in Java,
  at version **0.1.0 Beta**, with its last file dated **2011-11-08**. It needs a
  desktop office suite and cannot run headless.
- ODFBetter and ODF_Accessibility_Tester are abandoned.
- [`openxml-audit`](https://github.com/BramAlkema/openxml-audit) validates ODF
  **conformance**, explicitly not accessibility.
- `office-accessibility-checker`, `readrite`, and `filecap` cover OOXML/XLSX,
  not ODF.

`odflens` is an offline, CI-invokable ODF accessibility auditor with no
LibreOffice, no Java, and no GUI.

## Install

`odflens` is not published to npm. Install it from GitHub with the one-line script (requires [Bun](https://bun.sh)):

```bash
# One-line install (installs the `odflens` binary)
curl -fsSL https://raw.githubusercontent.com/srivtx/odflens/main/install.sh | sh

# Or run once, without installing
bunx github:srivtx/odflens report.odt

# Install globally
bun add -g github:srivtx/odflens
odflens report.odt

# Add to a project as a dev dependency
bun add -d github:srivtx/odflens
```

## Development

```bash
bun install
bun run make-fixtures          # fixtures/ is generated and gitignored
bun run src/cli.ts fixtures/bad.odt
```

## Usage

```bash
# Audit one or more files
odflens report.odt sheet.ods deck.odp

# A whole directory
odflens --dir docs/

# Machine-readable
odflens report.odt --json

# Summary only
odflens report.odt --quiet
```

`--json` prints a single JSON array of all results, so `odflens --json a.odt b.odt`
is valid JSON.

Exit codes:

| Code | Meaning |
|---|---|
| `0` | No findings at or above `--fail-on` |
| `1` | Findings at or above `--fail-on` |
| `2` | Invalid usage, or a document that cannot be read/parsed as ODF |
| `3` | An input file or the `--sarif` output could not be read/written |

`--fail-on none` suppresses exit code `1` for findings; fatal parse failures
(`2`) and I/O errors (`3`) still fail.

### Library

```ts
import { audit, formatText, openOdf, detectKind } from "odflens";

const result = audit(bytes, "report.odt");
// { file, kind: "odt", issues, counts, fatal? }
```

The package ships **TypeScript source** and is intended to be consumed through
Bun (or any bundler that resolves TypeScript). `openOdf(data, limits)` accepts
optional per-entry and total decompression ceilings.

## Rules

| Code | Severity | WCAG | Applies to | Check |
|---|---|---|---|---|
| ODF-000 | error | — | all | Package is unreadable, not a zip, unparseable, or missing `content.xml` (fatal) |
| ODF-LANG-001 | error | 3.1.1 | all | No document language (`dc:language` or `xml:lang` / `fo:language`) |
| ODF-TITLE-002 | error | — | all | No non-empty `dc:title` in `meta.xml` |
| ODF-ALT-003 | error | 1.1.1 | all | Image/embedded-object frame without `svg:title` or `svg:desc` |
| ODF-HEAD-004 | warning | 1.3.1 | ODT | Heading outline levels skip |
| ODF-HEAD-005 | warning | 1.3.1 | ODT | Body text but no headings |
| ODF-TBL-006 | error | 1.3.1 | ODT | Table with rows but no `table:table-header-rows` |
| ODF-LINK-007 | warning | 2.4.4 | all | Link whose text is a raw URL |
| ODF-IMG-008 | info | 1.1.1 | all | Image referenced over `http(s)://` |

`ODF-000` is an error-severity, fatal issue: the document could not be audited
at all, and the CLI exits `2`.

## How it works

```
.odt/.ods/.odp ──unzip (fflate)──▶ mimetype + META-INF/manifest.xml
                                    ├── kind detection (mimetype, then body element)
                                    └── content.xml / styles.xml / meta.xml
                                          └── local-name findAll + rules
                                                └── JSON / text report
```

The parser matches element local names (`text:h`, `draw:frame`, `svg:title`), so
the rules read the same regardless of the prefix LibreOffice chose. It does not
validate against the full ODF schema.

## CI

```yaml
- name: ODF accessibility gate
  run: odflens --dir public/docs --quiet
```

By default `odflens` exits `1` on error-severity issues only. Use
`--fail-on warning|info|none` to change the gate threshold.

## SARIF and code scanning

`odflens` can emit [SARIF 2.1.0](https://json.schemastore.org/sarif-2.1.0.json) so
results show up as annotations in GitHub code scanning, VS Code, and any other
SARIF-aware viewer:

```bash
odflens --dir public/docs --sarif odflens.sarif
```

Each issue becomes a result with `ruleId` set to the ODF rule code (for example
`ODF-LANG-001`), a `level` mapped from its severity (`error`/`warning`/`note`),
a URL-encoded location pointing at the source file, and accessibility tags.
Unreadable files are reported too, as `ODF-000`. The `rules` array always
contains the full rule catalog (not just the codes that fired), and results
omit a synthetic line region because ODF rules operate on the document model
rather than source lines.

```yaml
- name: Audit ODF documents
  run: odflens --dir public/docs --sarif odflens.sarif

- name: Upload SARIF
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: odflens.sarif
```

Use `--fail-on` to tune when the job itself fails (`error` by default):

```bash
odflens --dir public/docs --sarif odflens.sarif --fail-on warning
```

The same output is available from the library:

```ts
import { audit, toSarif, writeSarif } from "odflens";

const result = audit(bytes, "report.odt");
const sarif = toSarif(result, "odflens", "0.2.0");
await writeSarif("odflens.sarif", [result], "odflens", "0.2.0");
```

## Testing

| Gate | Result |
|---|---|
| `bun test` | 46 tests |
| `bunx tsc --noEmit` | clean (strict) |
| fixtures | `bun run make-fixtures` writes good/bad ODT, ODS, and ODP samples |

Fixtures are real ODF zips built in-repo with `mimetype`,
`META-INF/manifest.xml`, `content.xml`, `styles.xml`, and `meta.xml`.

## Privacy

No network code. Files are parsed locally and never uploaded.

## Limitations

- Static XML checks; it does not render or convert the document.
- ODS and ODP are audited with the shared rule set, but some checks are
  ODT-specific: the heading-outline rules and the table-header rule are only
  meaningful for text documents, so they are not applied to spreadsheets or
  presentations. Spreadsheet header rows are frequently left unmarked, so
  `ODF-TBL-006` would otherwise false-positive on valid sheets.
- Remote images are flagged, not fetched.

## The suite

- **booklens** — EPUB accessibility audit and fix
- **officelens** — DOCX/PPTX accessibility audit
- **odflens** — ODT/ODS/ODP accessibility audit *(this repo)*
- **iconlens** — standalone SVG accessibility lint
- **waxseal** — detached Ed25519 seal for WACZ web archives

## License

[MIT](LICENSE).
