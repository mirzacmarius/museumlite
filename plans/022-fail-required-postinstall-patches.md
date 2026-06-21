# Plan 022: Stop hiding required postinstall patch failures

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8a341d62..HEAD -- package.json scripts/apply-patches.js patches apps/app/src packages/ui/src`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW-MED
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `8a341d62`, 2026-06-19

## Why this matters

The repository carries a required compatibility patch for
`@xixixao/uploadstuff`. The patch script can detect missing target files and
exit non-zero, but root `postinstall` masks that failure with `|| true`. A
dependency layout/version drift can silently skip the patch and only surface
later as typecheck/build failures.

## Current state

- Root `postinstall` hides patch failure.

```text
package.json:12 "postinstall": "node scripts/apply-patches.js || true; node scripts/sync-worktree-env.mjs || true",
```

- The patch script returns failure when the target file is missing.

```text
apply-patches.js:24 if (!fs.existsSync(targetFile)) {
apply-patches.js:25   console.warn(`Target file not found: ${targetFile}`);
apply-patches.js:26   return false;
apply-patches.js:71 process.exit(success ? 0 : 1);
```

- App/UI code imports the patched package:
  `apps/app/src/app/[locale]/(dashboard)/objects/_components/collection-edit-form/use-collection-edit-form-media.ts`
  and `packages/ui/src/components/upload-input.tsx`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Patch script | `node scripts/apply-patches.js` | exit 0 |
| Install lifecycle check | `bun install --frozen-lockfile` | exit 0 |
| Typecheck | `bun run typecheck` | exit 0 |
| Lint | `bun run lint` | exit 0 |

## Scope

**In scope**:
- `package.json`
- `scripts/apply-patches.js`
- `patches/@xixixao+uploadstuff+0.0.5.patch`
- Docs only if install behavior changes need a one-line note

**Out of scope**:
- Replacing `@xixixao/uploadstuff`.
- Reworking upload UI.
- Running dependency upgrades.

## Git workflow

- Branch: `advisor/022-fail-required-postinstall-patches`
- Commit message example: `chore: fail install when required patches do not apply`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Separate required patching from best-effort env sync

Change `postinstall` so `node scripts/apply-patches.js` is not followed by
`|| true`. Keep env sync best-effort if that is intentional:

```json
"postinstall": "node scripts/apply-patches.js; node scripts/sync-worktree-env.mjs || true"
```

If shell separator behavior is a concern, split into named scripts such as
`postinstall:patches` and `postinstall:env`.

**Verify**: `node scripts/apply-patches.js` -> exit 0.

### Step 2: Make patch script output actionable

If the script fails because a target file is missing, ensure the message tells
the contributor which package/patch failed and that the dependency may have
changed. Do not print environment values or secrets.

**Verify**: temporarily inspect code path; do not force a failing install by
editing node_modules.

### Step 3: Run install lifecycle and checks

Run:

```bash
bun install --frozen-lockfile
bun run typecheck
bun run lint
```

All must exit 0.

## Test plan

No product tests are required. The verification is that the required patch script
passes and install fails if it would not.

## Done criteria

- [ ] `postinstall` no longer masks `apply-patches.js` failure.
- [ ] Env sync remains best-effort if desired.
- [ ] Patch script output identifies failed patch targets clearly.
- [ ] Install, typecheck, and lint pass.
- [ ] `plans/README.md` status row updated.

## STOP conditions

- `apply-patches.js` currently fails on a clean install.
- The package no longer needs the patch; in that case report and propose
  deleting the patch instead.
- A cited excerpt no longer matches live code.

## Maintenance notes

Required patches should fail fast. Best-effort developer conveniences, like env
sync, can remain non-blocking.
