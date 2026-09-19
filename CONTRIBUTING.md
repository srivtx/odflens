# Contributing to odflens

Thanks for helping improve OpenDocument accessibility tooling. This document
covers what you need to build, test, and submit a change.

## Development setup

odflens targets [Bun](https://bun.sh) and TypeScript in strict mode.

```bash
git clone https://github.com/srivtx/odflens.git
cd odflens
bun install
```

Run the CLI from source while you work:

```bash
bun run src/cli.ts fixtures/bad.odt
```

## The gate

Every pull request must pass the same gate CI runs:

```bash
bunx tsc --noEmit && bun test
```

Do not open a PR with a red typecheck or a failing test. Fix the cause rather
than disabling a rule or test.

## Fixtures

`fixtures/` holds the ODF files the tests run against. They are generated, not
hand-edited:

```bash
bun run make-fixtures
```

`good.odt` is a clean document, while `bad.odt` and `bad.ods` are intentionally
broken and cover the text and spreadsheet paths. When you add a rule, add a
fixture that exercises it and assert on the emitted issue codes in
`tests/rules.test.ts`. CLI behavior belongs in `tests/cli.test.ts`.

## Code style

- Strict TypeScript. No `any` to silence a type error, no non-null assertions
  to dodge null checks.
- No new runtime dependencies without discussion in an issue first. The offline
  and dependency-light posture is a feature.
- No network access, ever. Unzipping and parsing are local operations.
- Keep the ODT, ODS, and ODP paths explicit; do not assume a shared document
  model where the formats differ.
- Match the surrounding style; keep modules small and focused.
- No comments unless they explain something non-obvious.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <summary>

fix(odt): report headings that skip a level
feat(ods): flag tables without header rows
test(cli): cover --json exit codes
docs: describe the directory scan
```

Common types: `feat`, `fix`, `test`, `docs`, `refactor`, `chore`. Useful scopes:
`odt`, `ods`, `odp`, `rules`, `cli`.

## Pull request checklist

- [ ] Tests added or updated for the change.
- [ ] `bunx tsc --noEmit` is clean.
- [ ] `bun test` passes.
- [ ] Docs (`README.md`) updated when behavior or flags change.
- [ ] Commit messages follow Conventional Commits.
