<div align="center">

# odflens

**Offline accessibility audit for OpenDocument files (ODT / ODS / ODP).**

[![CI](https://github.com/srivtx/odflens/actions/workflows/ci.yml/badge.svg)](https://github.com/srivtx/odflens/actions/workflows/ci.yml)
[![release](https://img.shields.io/github/v/release/srivtx/odflens?sort=semver&color=4f46e5)](https://github.com/srivtx/odflens/releases)
[![license](https://img.shields.io/badge/license-MIT-0f766e)](LICENSE)
[![runtime](https://img.shields.io/badge/runtime-Bun-14151A?logo=bun&logoColor=white)](https://bun.sh)
[![types](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](tsconfig.json)
[![tests](https://img.shields.io/badge/tests-6-0f766e)](#testing)
[![network](https://img.shields.io/badge/network-none-0f766e)](#privacy)

</div>

---

## The problem

OpenDocument is a mandated format across large parts of EU and public-sector
publishing under EN 301 549 and the Web Accessibility Directive — and it has
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

```bash
bun install
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

Exit code is `1` on any error-severity issue, `0` otherwise, `2` with no
arguments.

### Library

```ts
import { audit, formatText, openOdf, detectKind } from "odflens";

const result = audit(bytes, "report.odt");
// { file, kind: "odt", issues, counts }
```

## Rules

| Code | Severity | WCAG | Check |
|---|---|---|---|
| ODF-LANG-001 | error | 3.1.1 | No document language (`office:language` / `fo:language`) |
| ODF-TITLE-002 | error | — | No non-empty `dc:title` in `meta.xml` |
| ODF-ALT-003 | error | 1.1.1 | Image frame without `svg:title` or `svg:desc` |
| ODF-HEAD-004 | warning | 1.3.1 | Heading outline levels skip |
| ODF-HEAD-005 | warning | 1.3.1 | Body text but no headings |
| ODF-TBL-006 | error | 1.3.1 | Table with rows but no `table:table-header-rows` |
| ODF-LINK-007 | warning | 2.4.4 | Link whose text is a raw URL |
| ODF-IMG-008 | info | 1.1.1 | Image referenced over `http(s)://` |

`ODF-000` (info) is reported when the package is unreadable or has no
`content.xml`.

## How it works

```
.odt/.ods/.odp ──unzip (fflate)──▶ mimetype + META-INF/manifest.xml
                                    ├── kind detection (mimetype, then body element)
                                    └── content.xml / styles.xml / meta.xml
                                          └── namespace-aware findAll + rules
                                                └── JSON / text report
```

The parser matches namespaced keys (`text:h`, `draw:frame`, `svg:title`) so the
rules read the same regardless of the prefix LibreOffice chose.

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
a location pointing at the source file, and accessibility tags. The rules array
is built from the distinct codes found.

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
const sarif = toSarif(result, "odflens", "0.1.0");
await writeSarif("odflens.sarif", [result], "odflens", "0.1.0");
```

## Testing

| Gate | Result |
|---|---|
| `bun test` | 6 tests |
| `bunx tsc --noEmit` | clean (strict) |
| fixtures | `bun run make-fixtures` writes broken/clean ODT and a broken ODS |

Fixtures are real ODF zips built in-repo with `mimetype`,
`META-INF/manifest.xml`, `content.xml`, `styles.xml`, and `meta.xml`.

## Privacy

No network code. Files are parsed locally and never uploaded.

## Limitations

- Static XML checks; it does not render or convert the document.
- ODS and ODP rule coverage is a subset of the ODT coverage.
- Remote images are flagged, not fetched.

## The suite

- **booklens** — EPUB accessibility audit and fix
- **officelens** — DOCX/PPTX accessibility audit
- **odflens** — ODT/ODS/ODP accessibility audit *(this repo)*
- **iconlens** — standalone SVG accessibility lint
- **waxseal** — detached Ed25519 seal for WACZ web archives

## License

[MIT](LICENSE).
