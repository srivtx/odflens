# odf-a11y

Offline, cross-platform accessibility auditor for **OpenDocument (`.odt`, `.ods`, `.odp`)** files.

`odf-a11y` reads the ZIP/XML package directly — no LibreOffice, no Java, no browser, no
network — and reports the accessibility defects that ship silently inside documents
produced by LibreOffice, Collabora, Google Docs exports, and government templates.

```sh
bunx odf-a11y report.odt
odf-a11y --dir documents --json
```

## The gap

OpenDocument is the default office format for governments, universities, and public
bodies across Europe and beyond. Most published `.odt`/`.ods`/`.odp` files are created
once and never reviewed for accessibility, even where the law requires it.

The tooling landscape does not cover the case:

| Tool | What it actually does | Why it misses OpenDocument |
| --- | --- | --- |
| [AccessODF](https://github.com/accessodf/accessodf) | The only real ODF accessibility checker | A **LibreOffice GUI extension written in Java**, version **0.1.0 Beta**, last file dated **2011-11-08**. Cannot run in CI, on a server, or on a machine without LibreOffice. |
| ODFBetter | ODF tooling | Dead / unmaintained |
| ODF_Accessibility_Tester | ODF accessibility testing experiment | Dead / unmaintained |
| [openxml-audit](https://github.com/opendocsg/openxml-audit) | **ODF conformance** validation | Validates against the ODF schema; it is not an accessibility checker |
| [office-accessibility-checker](https://github.com/OfficeDev/office-accessibility-checker), [readrite](https://github.com/readrite), [filecap](https://filecap.io) | Accessibility checks for office files | Cover **OOXML / XLSX (Word, Excel, PowerPoint)** — not OpenDocument |

There is **no offline, cross-platform, CI-invokable accessibility auditor for
OpenDocument files**. `odf-a11y` fills that gap with a dependency-light CLI and library
that runs anywhere Bun runs.

## Rules

| Rule | Severity | Description | WCAG |
| --- | --- | --- | --- |
| `ODF-LANG-001` | error | Document does not declare a language (`office:language` / `fo:language`) | 3.1.1 |
| `ODF-TITLE-002` | error | Metadata has no non-empty `dc:title` | 2.4.2 |
| `ODF-ALT-003` | error | Image or image frame has no alternative text (`svg:title` / `svg:desc`) | 1.1.1 |
| `ODF-HEAD-004` | warning | Heading outline levels skip a level (e.g. h1 followed by h3) | 1.3.1 |
| `ODF-HEAD-005` | warning | Content has paragraphs but no headings | 1.3.1 |
| `ODF-TBL-006` | error | Table has rows but no `table:table-header-rows` | 1.3.1 |
| `ODF-LINK-007` | warning | Link text is a raw URL instead of descriptive text | 2.4.4 |
| `ODF-IMG-008` | info | Image references a remote `http(s)` resource (privacy/offline concern) | 1.1.1 |

> Rule IDs and severities are shown for reference; the authoritative set lives in
> `src/rules.ts`.

## CLI

```
odf-a11y <file...> [--json] [--quiet]
odf-a11y --dir <path> [--json] [--quiet]
```

- `--dir <path>` audits every `.odt`, `.ods`, and `.odp` in `path` (non-recursive, sorted).
- `--json` emits machine-readable JSON instead of text.
- `--quiet` prints one summary line per file.
- Exit code `0` when no errors, `1` when any file has `counts.error > 0`, `2` on bad usage.

```sh
odf-a11y report.odt
odf-a11y --dir public/documents
odf-a11y --dir public/documents --quiet
odf-a11y report.odt --json
```

## Library

```ts
import { audit, formatText, formatJson } from "odf-a11y";

const data = new Uint8Array(await Bun.file("report.odt").arrayBuffer());
const result = audit(data, "report.odt");

if (result.counts.error > 0) {
  console.error(formatText(result));
  process.exit(1);
}
```

`audit(data, file?)` returns an `AuditResult` with `kind` (`odt` | `ods` | `odp` | `odf`),
`issues`, and per-severity `counts`. Lower-level exports — `openOdf` and `detectKind` —
are also available.

### JSON output

```json
{
  "file": "report.odt",
  "kind": "odt",
  "issues": [
    {
      "code": "ODF-ALT-003",
      "severity": "error",
      "message": "Image frame has no alternative text (svg:title or svg:desc).",
      "location": "report.odt",
      "wcag": "1.1.1"
    }
  ],
  "counts": { "error": 1, "warning": 0, "info": 0 }
}
```

## CI

```yaml
- name: Audit OpenDocument accessibility
  run: odf-a11y --dir public/documents
```

The process exits non-zero on the first accessibility error, so an inaccessible document
fails the build.

## Development

```sh
bun install
bun run typecheck
bun test
bun run make-fixtures   # writes fixtures/bad.odt, fixtures/good.odt, fixtures/bad.ods
```

## Limitations

- **Static XML checks only.** `odf-a11y` inspects the package's XML; it does **not**
  render the document and cannot evaluate visual order, real contrast, or effective
  reading order.
- **No rendering / no layout.** Colour contrast and reading order require a layout
  engine and are out of scope.
- **ODS/ODP coverage is a subset.** The shared package-level rules (language, title)
  apply, but document-body rules target the ODT text model; spreadsheet- and
  presentation-specific accessibility checks are limited.
- **Heuristic, not exhaustive.** Presence of a heading, alt text, or language is
  checked, not whether it is meaningful.

## License

MIT
