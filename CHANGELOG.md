# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Unreadable documents (non-zip, empty zip, missing/unparseable `content.xml`)
  are now fatal `ODF-000` errors and exit `2` instead of passing CI silently.
- Rules are gated by document kind: image alt-text checks only apply to frames
  embedding an image/object, heading rules are ODT-only, and the table-header
  rule no longer false-positives on ODS/ODP.
- Language detection accepts the standard `dc:language`, `xml:lang`, and
  `fo:language` signals and ignores the non-standard `office:language`.
- Decompression is bounded by per-entry and total uncompressed size ceilings.
- `--json` emits one JSON array; `--dir` errors are clean; exit codes are
  defined and documented (`0`/`1`/`2`/`3`).

## [0.1.0] - 2026-09-19

### Added

- Initial release of `odflens`.
- `audit(data, file?)` static accessibility audit for OpenDocument (`.odt`, `.ods`,
  `.odp`) packages.
- `openOdf` and `detectKind` helpers for reading and identifying ODF packages.
- Rules for missing document language, missing `dc:title`, missing image alternative
  text, skipped heading outline levels, body text without headings, tables without
  header rows, raw-URL link text, and remotely hosted images.
- `formatText` and `formatJson` reporters.
- `odflens` CLI with `--dir`, `--json`, and `--quiet` flags.
- `makeBadOdt` / `makeGoodOdt` / `makeBadOds` fixtures and a `writeFixturesTo(dir)`
  helper.
- GitHub Actions CI running typecheck, tests, and fixture CLI checks.

[0.1.0]: https://github.com/srivtx/odflens/releases/tag/v0.1.0
