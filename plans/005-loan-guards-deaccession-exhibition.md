# Plan 005: Guard deaccession and exhibition location changes against on-loan objects

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 12620298..HEAD -- packages/backend/convex/utils/collectionDisposition.ts packages/backend/convex/utils/exhibitionObjectLocation.ts packages/backend/convex/utils/exhibitionWorkflow.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (complements plan 004's shared helper if it lands first)
- **Category**: bug
- **Planned at**: commit `12620298`, 2026-06-12

## Why this matters

The codebase consistently blocks destructive/location-changing operations on objects that are currently on loan — except in two places, which silently corrupt custody/location truth:

1. **Hard deaccession** (`deleteCollectionHandler`) marks an object deaccessioned with **no loan check**, while its siblings `archiveCollectionHandler` and `softDeleteCollectionHandler` both throw for `status === "loaned"`, and the formal `deaccessions.ts` path also blocks loaned objects.
2. **Exhibition add/install/activate** rewrite an object's `currentLocationId` with **no loan guard**, even though `objectMoves.ts` treats active/dispatched loans as blockers for moves. A loaned object can be installed in an exhibition and have its location overwritten while physically out on loan.

The fix applies the same guard already used by the sibling operations, so behavior becomes consistent.

## Current state

### 5a. Hard deaccession missing the guard

`packages/backend/convex/utils/collectionDisposition.ts:12-47` (`deleteCollectionHandler`) calls `markCollectionDeaccessioned` directly with no status check. Compare:
- `archiveCollectionHandler` (`:64-66`): `if (collection.status === "loaned") throw new Error("Cannot archive an object that is currently on loan");`
- `softDeleteCollectionHandler` (`:109-111`): `if (collection.status === "loaned") throw new Error("Cannot delete an object that is currently on loan");`
- `deaccessions.ts:225-227`: formal deaccession also blocks loaned objects.

### 5b. Exhibition location writes missing the guard

- `packages/backend/convex/utils/exhibitionObjectLocation.ts:19-51` (`addExhibitionObjectHandler`) — reads the collection but never checks loan state before linking.
- `packages/backend/convex/utils/exhibitionObjectLocation.ts:111-122` (`installObjectHandler`) — patches `collections.currentLocationId` with no loan guard.
- `packages/backend/convex/utils/exhibitionWorkflow.ts:309-324` (`activateExhibitionHandler`) — bulk-installs pending objects and updates locations the same way.

Authority for "is on loan": `packages/backend/convex/objectMoves.ts:72` (`ACTIVE_LOAN_STATUSES = ["active", "dispatched"]`) and its eligibility checks (`objectMoves.ts:456-472`); also the simple signal `collection.status === "loaned"` used by the disposition handlers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Backend lint | `cd packages/backend && bun run lint` | exit 0 |
| Backend tests | `cd packages/backend && bun run test:once` | all pass |

## Scope

**In scope**:
- `packages/backend/convex/utils/collectionDisposition.ts` (`deleteCollectionHandler`)
- `packages/backend/convex/utils/exhibitionObjectLocation.ts` (`addExhibitionObjectHandler`, `installObjectHandler`)
- `packages/backend/convex/utils/exhibitionWorkflow.ts` (`activateExhibitionHandler`)
- Relevant test files in `packages/backend/tests/` or `packages/backend/convex/*.test.ts`

**Out of scope**:
- `objectMoves.ts` — reuse its status constant, don't modify.
- The exhibition workflow's non-location logic.
- Changing the product rule that loan+exhibition are mutually exclusive — if the business actually wants concurrent loan+exhibition, that's a product decision (see STOP conditions).

## Git workflow

- Branch: `advisor/005-loan-guards`
- Conventional commits, e.g. `fix(collections): block hard deaccession of objects on loan`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Guard `deleteCollectionHandler`

In `collectionDisposition.ts`, after loading `collection` and before `markCollectionDeaccessioned`, add:
`if (collection.status === "loaned") throw new Error("Cannot deaccession an object that is currently on loan");`
Match the wording/position of the sibling handlers in the same file.

**Verify**: `cd packages/backend && bun run lint` → exit 0.

### Step 2: Guard exhibition add/install/activate

Decide the canonical check. Simplest consistent option: reject when `collection.status === "loaned"`. Stronger option (matches `objectMoves`): reject when any active/dispatched loan item references the collection. Pick the **status === "loaned"** check for this plan (it's what disposition handlers use and what `markCollectionLoaned` sets), unless plan 004's shared helper already exists and is importable — then use it.

- `addExhibitionObjectHandler`: before inserting the exhibition-object link, throw if the collection is loaned.
- `installObjectHandler`: before patching `currentLocationId`, throw if loaned.
- `activateExhibitionHandler`: when iterating pending objects to install, skip-or-throw for loaned objects. **Choose throw** (fail the activation with a clear message naming the object) unless existing tests expect partial activation — check the test file first.

**Verify**: `cd packages/backend && bun run lint` → exit 0.

### Step 3: Run the suite

**Verify**: `cd packages/backend && bun run test:once` → all pass. Fix any existing test that installed/activated a loaned object by adjusting the fixture so the object is `active`, not `loaned` (unless the test was asserting the buggy behavior — then update its expectation).

## Test plan

- Deaccession (`deleteCollection`) on a loaned object → throws.
- Adding a loaned object to an exhibition → throws.
- Installing a loaned object → throws.
- Activating an exhibition that contains a loaned pending object → throws (or the chosen behavior), and the exhibition is not left half-activated.
- Happy paths: same operations on an `active` (not loaned) object succeed.
Model after existing exhibition/collection tests (`rg -l "exhibition" packages/backend/tests packages/backend/convex --glob '*.test.ts'`).

Verification: `cd packages/backend && bun run test:once` → all pass with new tests.

## Done criteria

- [ ] `deleteCollectionHandler` throws for loaned objects
- [ ] Exhibition add/install/activate all reject loaned objects
- [ ] New tests cover each guard plus happy paths
- [ ] `cd packages/backend && bun run lint` exits 0
- [ ] `cd packages/backend && bun run test:once` exits 0
- [ ] No out-of-scope files modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- Existing tests assert that a loaned object **can** be added to an exhibition (i.e. the product intentionally allows concurrent loan + exhibition) — then this is a product decision, not a bug; report instead of changing behavior.
- `activateExhibitionHandler` is expected to partially succeed and the throw would regress a real workflow.
- A cited excerpt doesn't match the live code (drift).

## Maintenance notes

- "Is this object on loan?" is now checked in several handlers via `status === "loaned"`. If loan status tracking ever diverges from the `collections.status` field, centralize on the `objectMoves` loan-item check. Reviewers: any new operation that writes `currentLocationId` or changes lifecycle status should consult the same guard.
