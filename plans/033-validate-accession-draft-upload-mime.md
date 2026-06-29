# Plan 033: Validate MIME type on accession draft uploads

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If any STOP condition occurs, stop and report. When done, update the status row for this plan in `plans/README.md` unless your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat f8648557..HEAD -- packages/backend/convex/accessions.ts packages/backend/convex/media.ts packages/backend/convex/utils/mediaAssets.ts`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `f8648557`, 2026-06-29

## Why this matters

Primary media uploads validate MIME types, but accession draft uploads accept any `mimeType` and issue a storage upload URL without checking it. That allows disallowed file types into accession/checklist flows.

## Current state

- `packages/backend/convex/accessions.ts:495-517` — `generateDraftUploadUrl` accepts `mimeType` but never validates it.
- `packages/backend/convex/media.ts:78-79` — validates with `isSupportedMediaMimeType(args.mimeType)`.
- Helper: `packages/backend/convex/utils/mediaAssets.ts` exports `isSupportedMediaMimeType`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Accessions tests | `cd packages/backend && bun test accessions.test.ts` | all pass |
| Full backend tests | `cd packages/backend && bun test` | all pass |
| Typecheck | `bun run typecheck` | exit 0 |
| Lint | `bun run lint` | exit 0 |

## Scope

**In scope**:
- `packages/backend/convex/accessions.ts` (import + validation in `generateDraftUploadUrl`; optionally `uploadChecklistDocument` if it binds storage without type check)

**Out of scope**:
- Replacing upload UI components
- Changing supported MIME allowlist in `mediaAssets.ts`
- Other upload paths (account documents, exhibitions) — separate plans

## Git workflow

- Branch: `advisor/033-validate-accession-draft-upload-mime`
- Commit message: `fix(accessions): validate draft upload MIME types`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Import helper

Add `isSupportedMediaMimeType` import from `./utils/mediaAssets` (same as `media.ts:19`).

### Step 2: Validate in generateDraftUploadUrl

Before `ctx.storage.generateUploadUrl()`, add:

```typescript
if (!isSupportedMediaMimeType(args.mimeType)) {
  throw new Error(`Unsupported file type: ${args.mimeType}`);
}
```

Mirror the error message style from `media.ts:78-79`.

**Verify**: read handler — validation appears before upload URL generation.

### Step 3: Tests

Add a convex-test case in an existing accessions test file (or extend `packages/backend/tests/accessions.test.ts`) that calls `generateDraftUploadUrl` with an unsupported MIME (e.g. `application/x-msdownload`) and expects failure; and a supported MIME (e.g. `image/jpeg`) succeeds when auth/quota fixtures allow.

**Verify**: `cd packages/backend && bun test accessions.test.ts` — new test passes.

### Step 4: Full gates

Run typecheck, lint, full backend tests.

## Done criteria

- [ ] `generateDraftUploadUrl` rejects unsupported MIME types
- [ ] At least one negative + one positive test
- [ ] typecheck, lint, backend tests pass
- [ ] Only in-scope files changed

## STOP conditions

- `isSupportedMediaMimeType` moved or renamed without equivalent
- Accession draft flow no longer uses `generateDraftUploadUrl`
- Cited excerpts don't match live code

## Maintenance notes

If checklist document attach path accepts `storageId` without re-validating type, consider a follow-up on `uploadChecklistDocument` — out of scope unless trivial guard using same helper.
