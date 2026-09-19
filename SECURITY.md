# Security Policy

## odflens

odflens audits the accessibility of OpenDocument files — text (`.odt`),
spreadsheets (`.ods`), and presentations (`.odp`). It opens an untrusted
package, parses its XML parts, and reports failures.

## Supported versions

The latest commit on `main` is the only supported version. Security fixes land
on `main` and ship in the next tagged release. Older tags do not receive
backports.

| Version | Supported |
| --- | --- |
| Latest on `main` | Yes |
| Older tags | No |

## Threat model

- **Offline by design.** odflens contains no network code. It never opens a
  socket, resolves external references, or checks for updates.
- **No telemetry.** Nothing about your documents, your usage, or your machine
  is collected or transmitted.
- **Documents never leave the machine.** Unzipping, XML parsing, and auditing
  all run in-process and locally.
- **Untrusted input.** An ODF file is treated as hostile: ZIP members and XML
  parts are parsed defensively, and a malformed, deeply nested, or oversized
  package fails safely rather than escapes the working directory or exhausts
  the process.
- **No code execution from input.** Macros, scripts, and external links in a
  document are never evaluated or followed.
- **No suite dependency.** Auditing does not shell out to LibreOffice or Java,
  so there is no desktop application in the trust boundary.

## Resource limits

`openOdf` bounds every package before and after decompression. The defaults are:

| Limit | Default | Notes |
| --- | --- | --- |
| Per-entry uncompressed size | 64 MiB | Rejected by the ZIP filter |
| Total uncompressed size | 512 MiB | Summed during filtering and re-checked against the decoded bytes after extraction |
| Member count | 65,535 file entries | Directories excluded; rejects archives made of huge numbers of zero-byte entries |
| Member names | relative only | Absolute paths, Windows drive letters, backslashes, and `.`/`..`/empty segments are rejected |

These are configurable via the `OdfLimits` argument to `openOdf`; the defaults
are the ceilings enforced by the CLI. A package that trips a limit is reported
as a fatal `ODF-000` error and the CLI exits `2`.

## Reporting a vulnerability

Report privately through GitHub Security Advisories on the repository:

https://github.com/srivtx/odflens/security/advisories/new

Do not open a public issue for a suspected vulnerability. Include a
description, the affected revision, a minimal reproducer (an ODT, ODS, or ODP
fixture where possible), and any suggested fix. Expect an acknowledgement
within a few days.

## Verifying a build

```bash
bun install
bunx tsc --noEmit
bun test
```

This installs the locked dependency set, typechecks in strict mode, and runs
the test suite against the generated fixtures. In CI the same gate runs on
every push and pull request.
