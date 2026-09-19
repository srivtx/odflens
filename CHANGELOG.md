# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-09-19

### Added

- Initial release of `odf-a11y`.
- `audit(data, file?)` static accessibility audit for OpenDocument (`.odt`, `.ods`,
  `.odp`) packages.
- `openOdf` and `detectKind` helpers for reading and identifying ODF packages.
- Rules for missing document language, missing `dc:title`, missing image alternative
  text, skipped heading outline levels, body text without headings, tables without
  header rows, raw-URL link text, and remotely hosted images.
- `formatText` and `formatJson` reporters.
- `odf-a11y` CLI with `--dir`, `--json`, and `--quiet` flags.
- `makeBadOdt` / `makeGoodOdt` / `makeBadOds` fixtures and a `writeFixturesTo(dir)`
  helper.
- GitHub Actions CI running typecheck, tests, and fixture CLI checks.

[0.1.0]: https://github.com/example/odf-a11y/releases/tag/v0.1.0
