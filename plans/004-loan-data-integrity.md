# Plan 004: Fix loan data-integrity gaps (dedup, dispatched status, date and number validation)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 12620298..HEAD -- packages/backend/convex/loans.ts`
> If `loans.ts` changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `12620298`, 2026-06-12

## Why this matters

The loan create/update path has four integrity gaps that let invalid loans persist and corrupt downstream state (return/dispatch logic, due-date reminders, exports, audit trails):

1. **Duplicate loan items**: `create` and `addItems` process `itemsToAdd` with `Promise.all` and no dedup, so the same `collectionId` passed twice both pass the "already loaned" check and both insert a `loanItems` row.
2. **`dispatched` loans not treated as active**: the conflict check only blocks `pending`/`active`, ignoring `dispatched`. The rest of the codebase (`objectMoves.ts:72` `ACTIVE_LOAN_STATUSES = ["active", "dispatched"]`, `loans.ts:1266` `checkCollectionsInActiveLoans`) includes `dispatched`. A dispatched object can be double-booked.
3. **Inverted date ranges**: `create` and `update` store `startDate`/`endDate` with no check that `endDate >= startDate`, breaking reminders and reporting.
4. **Duplicate manual loan numbers**: a user-supplied `loanNumber` is stored with no uniqueness check within the org.

These are validation/consistency fixes — they only reject invalid input, so risk is low.

## Current state

### Conflict check (duplicated in two places)

`packages/backend/convex/loans.ts:162-217` (`create`) and `:330-385` (`addItems`) both run:

```typescript
await Promise.all(
  itemsToAdd.map(async (item) => {
    const collection = await ctx.db.get(item.collectionId);
    // ... org + status === "active" checks ...
    const existingLoanItem = await ctx.db
      .query("loanItems")
      .withIndex("by_collection", (q) => q.eq("collectionId", item.collectionId))
      .filter(/* no-op filter */)
      .first();
    if (existingLoanItem) {
      const existingLoan = await ctx.db.get(existingLoanItem.loanId);
      if (existingLoan && (existingLoan.status === "pending" || existingLoan.status === "active")) {
        throw new Error(`Collection ... is already in an active loan`);
      }
    }
    await ctx.db.insert("loanItems", { loanId, collectionId: item.collectionId, conditionOut: ... });
    await markCollectionLoaned(ctx, { collectionId: item.collectionId, changedBy: userId });
  }),
);
```

Problems visible here: (a) no dedup of `itemsToAdd` by `collectionId`; (b) status set omits `"dispatched"`; (c) the `.filter()` is a no-op and `.first()` may inspect an arbitrary historical loan item.

The correct status set already exists: `packages/backend/convex/loans.ts:1266-1273` (`checkCollectionsInActiveLoans`) includes `dispatched` and iterates all items; `packages/backend/convex/objectMoves.ts:72` defines `ACTIVE_LOAN_STATUSES`.

### Dates

`packages/backend/convex/loans.ts:133-141` (`create` insert) and `:819-826` (`update` patch) write `startDate`/`endDate` with no ordering validation.

### Manual loan number

`packages/backend/convex/loans.ts:99-104`:

```typescript
let loanNumber: string;
if (args.loanNumber) {
  loanNumber = args.loanNumber;   // no uniqueness check
} else {
  loanNumber = await generateNextLoanNumber(ctx, args.organizationId);
}
```

Schema: `loans` indexes (schema.ts ~1773-1819) do not include `(organizationId, loanNumber)`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Backend lint | `cd packages/backend && bun run lint` | exit 0 |
| Backend tests | `cd packages/backend && bun run test:once` | all pass |
| Run loans tests only | `cd packages/backend && bunx vitest run loans` | pass |

## Scope

**In scope**:
- `packages/backend/convex/loans.ts` (`create`, `addItems`, `update`, and a new shared helper)
- `packages/backend/convex/loans.test.ts` or `packages/backend/tests/loans.test.ts` (whichever exists; create tests there)

**Out of scope**:
- `packages/backend/convex/schema.ts` — do **not** add a unique index in this plan (Convex has no unique constraints; enforce in code). Adding an index for lookup performance is optional and only if `addItems`/number-check needs it; if you add one, that's the only schema edit allowed and it must be additive.
- `objectMoves.ts` and `checkCollectionsInActiveLoans` — reuse, don't modify.
- Frontend loan forms — backend validation is the source of truth; frontend mirroring is a separate nicety.

## Git workflow

- Branch: `advisor/004-loan-data-integrity`
- Conventional commits, e.g. `fix(loans): dedup items and treat dispatched loans as active`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add a shared active-loan-conflict helper

In `loans.ts`, add a module-scoped async helper, e.g. `assertCollectionNotOnActiveLoan(ctx, collectionId)`, that queries all `loanItems` for the collection by the `by_collection` index, loads each parent loan, and throws if any parent loan status is in `["pending", "active", "dispatched"]`. Reuse the status set from `objectMoves.ts` if importable, otherwise define a local `const BLOCKING_LOAN_STATUSES = ["pending", "active", "dispatched"] as const;` with a comment pointing at `objectMoves.ts:72`.

**Verify**: `cd packages/backend && bun run lint` → exit 0.

### Step 2: Dedup items and use the helper in `create` and `addItems`

- Before the `Promise.all`, dedup `itemsToAdd`/`args.collectionIds` by `collectionId` (e.g. via a `Map`); if a duplicate is found, throw `"Duplicate collection in loan items"` (or silently dedup — pick throw for clarity).
- Replace the inline `existingLoanItem` check with a call to the Step 1 helper.
- Keep `markCollectionLoaned` and the insert.
- Consider whether `Promise.all` over the same-collection set is still safe after dedup — it is, since each collection is now unique.

**Verify**: `cd packages/backend && bunx vitest run loans` → pass.

### Step 3: Validate date ordering in `create` and `update`

- In `create`, after resolving `args.startDate`/`args.endDate`, throw `"Loan end date cannot be before start date"` when `endDate !== undefined && endDate < startDate`.
- In `update`, compute the effective start/end (incoming arg falling back to the existing loan's value) and apply the same check before `ctx.db.patch`.

**Verify**: `cd packages/backend && bunx vitest run loans` → pass.

### Step 4: Enforce manual loan-number uniqueness

- When `args.loanNumber` is provided, query existing loans in the org with the same number (use `by_organization` index then filter in memory, or add a `by_organization_and_loanNumber` index if performance demands — additive schema change only) and throw `"Loan number already in use"` if found.

**Verify**: `cd packages/backend && bunx vitest run loans` → pass.

## Test plan

Add tests to the loans test file (model after the existing loan tests; find them with `rg -l "loans" packages/backend/tests packages/backend/convex --glob '*.test.ts'`):
- Creating a loan with the same `collectionId` listed twice → throws / results in exactly one `loanItems` row.
- Adding a collection already on a `dispatched` loan → throws "already in an active loan".
- Creating/updating a loan with `endDate < startDate` → throws.
- Creating a loan with a manual `loanNumber` that already exists in the org → throws; a unique one succeeds.
- Happy path: distinct collections, valid dates, unique number → succeeds with correct item count.

Verification: `cd packages/backend && bun run test:once` → all pass including the new tests.

## Done criteria

- [ ] Duplicate `collectionId` in `create`/`addItems` cannot create two `loanItems` rows
- [ ] Conflict check blocks `pending`, `active`, AND `dispatched` loans in both `create` and `addItems`
- [ ] `create` and `update` reject `endDate < startDate`
- [ ] Manual duplicate `loanNumber` within an org is rejected
- [ ] New tests cover all four cases and pass
- [ ] `cd packages/backend && bun run lint` exits 0
- [ ] `cd packages/backend && bun run test:once` exits 0
- [ ] No out-of-scope files modified except an optional additive index (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- `objectMoves.ts` exports `ACTIVE_LOAN_STATUSES` but it excludes `pending` and loan creation genuinely needs `pending` blocked too — confirm the intended set with the existing `checkCollectionsInActiveLoans` behavior before finalizing (it is the authority).
- A cited excerpt doesn't match the live code (drift).
- Enforcing loan-number uniqueness reveals existing duplicate numbers in test fixtures that legitimately exist — report rather than deleting fixtures.

## Maintenance notes

- The active-loan status set now lives in (at least) three places (`objectMoves.ts`, `checkCollectionsInActiveLoans`, the new helper). A follow-up should consolidate to one exported constant. Reviewers: ensure no new code reintroduces a two-status (`pending`/`active`-only) check.
- Convex has no DB-level uniqueness; the loan-number check is application-level and racy under concurrent creates. For strong guarantees a follow-up would need a dedicated counter/registry — note this if duplicate loan numbers become a real problem.
