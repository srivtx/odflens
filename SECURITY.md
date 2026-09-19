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
  package must fail safely rather than escape the working directory or exhaust
  the process.
- **No code execution from input.** Macros, scripts, and external links in a
  document are never evaluated or followed.
- **No suite dependency.** Auditing does not shell out to LibreOffice or Java,
  so there is no desktop application in the trust boundary.

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
