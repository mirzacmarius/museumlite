# Plan 008: Remove committed scratch artifacts and the orphan root convex/ stub

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git status --short && git log --oneline -1`
> If the repo HEAD is not `12620298` or later, or the listed files no longer
> exist, re-verify before deleting anything.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `12620298`, 2026-06-12

## Why this matters

The repository root is cluttered with one-off agent/session artifacts, design mockups, and a dead Convex stub directory. New contributors and AI agents treat the root as a source of truth and waste effort reading stale handoff docs or get confused by a second (empty) `convex/` project. Removing this noise makes the repo navigable and prevents the Convex CLI from being run against the wrong directory.

## Current state

Confirmed-present root artifacts (verify each still exists before deleting):
- Session/agent scratch: `MIGRATION_STATUS.md`, `SEED_DATA_SUMMARY.md`, `build-progress.txt`, `task_plan.md`, `subtask-3-2-completion-summary.md`, `notes.md`, `APP-IDEEA.md`
- One-off scripts/dumps: `audit_mutations.js`, `check.ts`, `en_keys.txt`, `no_keys.txt`
- Design mockups: `museumlite-app-design.html`, `museumlite.aura.build.html`, `sidebar-design.html`, `settings-page.html`, `object-page-content-design.html`, `collection-management-group-pages.html`, `image.png`, and the `aura-html-pages/` directory
- Build artifact: `tsconfig.tsbuildinfo`
- **Orphan Convex stub**: root `convex/` directory containing only `_generated/` with an empty API (`convex/_generated/api.d.ts` = `ApiFromModules<{}>`). The real backend is `packages/backend/convex/` (80+ modules). App imports use `@v1/backend/convex/_generated/api`, never root `convex/`.

The only build-relevant root script is `package.json` `postinstall` → `scripts/apply-patches.js` and `scripts/sync-worktree-env.mjs`; none of the above files are referenced by it.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Confirm no imports of a file | `rg -n "<filename>" --glob '!node_modules' .` | no source references |
| Confirm root convex unused | `rg -n "from \"convex/_generated\|@/convex/_generated" apps packages --glob '!node_modules'` | no matches (all use `@v1/backend`) |
| Lint | `bun run lint` | exit 0 |
| Typecheck | `bun run typecheck` | exit 0 |
| Build (optional, heavy) | `bun run build` | exit 0 |

## Scope

**In scope** (delete, after per-file verification):
- The scratch docs, one-off scripts/dumps, design mockups, `aura-html-pages/`, `tsconfig.tsbuildinfo`, and the root `convex/` directory listed above.
- `.gitignore` (add patterns for regenerable/scratch files).

**Out of scope** (do NOT delete):
- `README.md`, `LICENSE.md`, `CLAUDE.md`, `AGENTS.md` — real docs.
- `packages/backend/convex/` — the real backend.
- `scripts/`, `tooling/`, `biome.json`, `turbo.json`, `tsconfig.json`, `package.json`, `bun.lock`, `react-doctor.config.json`, `setup-config.json`, `skills-lock.json` — active config.
- Anything under `apps/`, `packages/`, `docs/`.
- `.agents/`, `plans/` — this skill's working files.

## Git workflow

- Branch: `advisor/008-root-cleanup`
- One commit, conventional: `chore: remove committed scratch artifacts and dead root convex stub`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Verify each target is truly unreferenced

For each file/dir in scope, run a reference search. Example batch:
`for f in MIGRATION_STATUS.md SEED_DATA_SUMMARY.md build-progress.txt task_plan.md subtask-3-2-completion-summary.md notes.md APP-IDEEA.md audit_mutations.js check.ts en_keys.txt no_keys.txt; do echo "== $f =="; rg -n --glob '!node_modules' --glob '!.git' "$f" . | grep -v "^$f"; done`

For the design HTML + `aura-html-pages/` + `image.png`: confirm nothing in `apps/`/`packages/` references them (`rg -n "aura-html-pages|museumlite-app-design|sidebar-design|settings-page|object-page-content-design|collection-management-group-pages" apps packages --glob '!node_modules'`).

For root `convex/`: confirm `rg -n "\"convex/_generated|/ml/convex/_generated|from [\"']\.\./convex" apps packages --glob '!node_modules'` returns nothing, and that all generated-API imports point at `@v1/backend`.

**Verify**: each search returns no source-code references (matches inside the files themselves or in docs being deleted are fine).

### Step 2: Delete the artifacts

Use `git rm -r` for tracked files/dirs so the deletion is staged. For the root `convex/` directory, `git rm -r convex/` (only if Step 1 confirmed it's the empty stub — double-check it has no `schema.ts`/`http.ts`/handler files: `ls convex/` should show only `_generated/`).

**Verify**: `ls` no longer shows the deleted files; `git status` shows them staged as deleted.

### Step 3: Update `.gitignore`

Add patterns so regenerable/scratch files don't return:
```
*.tsbuildinfo
build-progress.txt
*_keys.txt
```
Do not add overly broad patterns (e.g. `*.md`, `*.html`) that would ignore real docs or app templates.

**Verify**: `git check-ignore tsconfig.tsbuildinfo` → prints the path (matched).

### Step 4: Confirm the repo still builds and type-checks

**Verify**: `bun run lint` → exit 0; `bun run typecheck` → exit 0. (These confirm nothing imported the deleted files. Typecheck is memory-heavy — see AGENTS.md; allow it time.)

## Test plan

No unit tests — this is a deletion. The verification gates (lint + typecheck pass with the files gone) are the test. Optionally run `bun run build` for full confidence that no app references a deleted mockup/asset.

## Done criteria

- [ ] All in-scope artifacts deleted and staged (`git status` shows deletions)
- [ ] Root `convex/` directory removed (confirmed it was the empty stub)
- [ ] `.gitignore` updated with the three patterns
- [ ] `bun run lint` exits 0
- [ ] `bun run typecheck` exits 0
- [ ] No in-scope **keep** files touched
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- Any target file is referenced by source code, a build script, or an app import (do not delete it; report).
- Root `convex/` contains anything other than `_generated/` (it may be a real second deployment — do not delete).
- `bun run typecheck` fails after deletion (a deleted file was actually imported) — restore it and report.

## Maintenance notes

- The root design HTML mockups may have value as design references — if the team wants to keep them, relocate to `docs/design/` instead of deleting (mention this in the PR description so the reviewer can choose).
- `MIGRATION_STATUS.md` documents an in-progress i18n migration; before deleting, confirm the migration is complete or its status is tracked in Linear (MUS) instead. If it's still the only record of remaining work, move its content to a Linear issue first.
