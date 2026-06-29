# Plan 038: Docs hygiene bundle (AGENTS, env example, broken pointers)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If any STOP condition occurs, stop and report. When done, update the status row for this plan in `plans/README.md` unless your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat f8648557..HEAD -- AGENTS.md CLAUDE.md apps/app/.env.example README.md`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `f8648557`, 2026-06-29

## Why this matters

Agent/onboarding docs drift from reality (Next.js version, test commands, missing env vars), slowing setup and causing false CI assumptions.

## Current state

- `AGENTS.md` references Next.js 15; repo uses Next.js 16 (verify in `apps/app/package.json`).
- `apps/app/.env.example` missing `SKIP_ENV_VALIDATION=1` noted in agent cloud instructions.
- `CONTEXT.md` / `docs/adr/` pointers referenced in rules but may be missing or broken — verify and fix references or remove broken links.
- Stale `test:once` vs `test` guidance after plan 020.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Lint docs | `bun run lint` | exit 0 (docs-only change should still pass) |
| Verify Next version | `node -p "require('./apps/app/package.json').dependencies.next"` | confirms 16.x |

## Scope

**In scope** (docs/config examples only):
- `AGENTS.md`
- `CLAUDE.md` (if same stale lines)
- `apps/app/.env.example`
- Root `README.md` only if it has contradictory test/dev commands

**Out of scope**:
- Code changes
- Full marketing copy audit
- Creating new ADR files (only fix/remove broken pointers)

## Git workflow

- Branch: `advisor/038-docs-hygiene-bundle`
- Commit message: `docs: align agent guides and env example with current stack`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Fix Next.js version references

Update AGENTS.md (and CLAUDE.md if needed) from "Next.js 15" to "Next.js 16" where describing the app stack.

### Step 2: Fix test command guidance

Align docs with current scripts: root `bun run test` runs app + backend; backend `test` is finite vitest (note plan 037 if merged adds guard).

### Step 3: Update apps/app/.env.example

Add commented line:

```bash
# Skip t3-env validation in local dev when optional vars are unset
SKIP_ENV_VALIDATION=1
```

Keep existing `NEXT_PUBLIC_CONVEX_URL` example.

### Step 4: Fix or remove broken CONTEXT.md / docs/adr pointers

If files don't exist, remove links from AGENTS.md/CLAUDE.md or point to `plans/README.md` / existing docs that do exist. Do not invent ADR content.

**Verify**: `test -f CONTEXT.md` / list `docs/adr` — document outcome in commit message if pointers removed.

### Step 5: Lint

Run `bun run lint`.

## Done criteria

- [ ] No "Next.js 15" in AGENTS.md/CLAUDE.md stack descriptions
- [ ] `.env.example` documents SKIP_ENV_VALIDATION
- [ ] No broken doc links left pointing to missing files (or links removed)
- [ ] lint passes
- [ ] Only in-scope files changed

## STOP conditions

- `.env.example` is gitignored — report; use documented alternative path if present

## Maintenance notes

Re-run doc spot-check when major version bumps (Next, Convex) land.
