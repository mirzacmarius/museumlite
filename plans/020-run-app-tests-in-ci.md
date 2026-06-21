# Plan 020: Run every finite workspace test suite in CI

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8a341d62..HEAD -- package.json apps/app/package.json apps/app/vitest.config.ts packages/backend/package.json .github/workflows/check.yml turbo.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx/tests
- **Planned at**: commit `8a341d62`, 2026-06-19

## Why this matters

The app workspace has a finite Vitest suite, but CI only runs backend tests. A
PR can break app-side parser/page tests and still pass. The root `test` command
also delegates to `turbo test`, while the backend workspace's `test` script is
watch-mode `vitest`, making the local verification contract ambiguous.

## Current state

- Root delegates tests to Turbo.

```text
package.json:22 "test": "turbo test",
```

- Backend `test` is watch mode and finite test is separate.

```text
packages/backend/package.json:10 "test": "vitest",
packages/backend/package.json:11 "test:once": "vitest run",
```

- CI only runs backend finite tests.

```text
check.yml:54 - name: 🧪 Test (backend)
check.yml:55   working-directory: packages/backend
check.yml:56   run: bun run test:once
```

- App has a finite suite.

```text
apps/app/package.json:12 "test": "vitest run",
apps/app/vitest.config.ts:4 test: {
apps/app/vitest.config.ts:6   include: ["src/**/*.test.ts"],
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Root tests | `bun run test` | exits 0 and terminates |
| App tests | `bun run --cwd apps/app test` | exits 0 |
| Backend tests | `cd packages/backend && bun run test:once` | exits 0 |
| Lint | `bun run lint` | exits 0 |

## Scope

**In scope**:
- `package.json`
- `packages/backend/package.json`
- `.github/workflows/check.yml`
- `turbo.json` only if needed for explicit task behavior

**Out of scope**:
- Writing new tests.
- Fixing unrelated failing app tests unless the CI/script change reveals a
  simple config issue directly caused by this plan.

## Git workflow

- Branch: `advisor/020-run-app-tests-in-ci`
- Commit message example: `ci: run app vitest suite`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Make workspace test scripts finite

Change backend `test` to `vitest run` and keep watch mode under `test:watch`.
Keep `test:once` as an alias if other docs/scripts use it.

**Verify**: `cd packages/backend && bun run test -- --help` or
`cd packages/backend && bun run test:once` -> command is finite and exits 0.

### Step 2: Run app tests in CI

Either:

- change CI test job to run root `bun run test`, after confirming it terminates;
  or
- add a second CI step/job for `bun run --cwd apps/app test`.

Prefer the smallest change that avoids watch mode.

**Verify**: `bun run test` -> exits 0 locally. If root test is too broad or slow,
run `bun run --cwd apps/app test` and backend `test:once` separately and wire CI
the same way.

### Step 3: Update docs only if command names changed

If changing backend `test` semantics makes `AGENTS.md` or `CLAUDE.md` command
snippets wrong, update only the affected command lines. Do not rewrite docs.

**Verify**: `rg -n "test:once|bun test|bun run test" AGENTS.md CLAUDE.md README.md packages/backend/package.json .github/workflows/check.yml` -> no misleading command remains.

### Step 4: Full verification

Run:

```bash
bun run test
bun run lint
```

Both must exit 0.

## Test plan

No new product tests are required. Verification is command-level: root and CI test
commands must run backend and app finite suites.

## Done criteria

- [ ] CI runs backend and app finite tests.
- [ ] `bun run test` terminates successfully or CI explicitly runs both finite
      workspace test commands.
- [ ] Watch mode remains available as `test:watch`.
- [ ] Lint passes.
- [ ] `plans/README.md` status row updated.

## STOP conditions

- App tests currently fail for product reasons unrelated to CI wiring.
- `turbo test` still enters watch mode after script changes.
- A cited excerpt no longer matches live code.

## Maintenance notes

Every workspace that adds a finite test suite should be included in CI, either
through root `turbo test` or an explicit workflow job.
