# Plan 048: Test applyBillingSubscriptionEvent pipeline

> **Executor instructions**: Follow step by step. SKIP updating `plans/README.md`.
>
> **Drift check**: `git diff --stat 37e12dee..HEAD -- packages/backend/convex/subscriptions.ts packages/backend/convex/subscriptions.test.ts packages/backend/tests/http-polar.test.ts`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: 042
- **Category**: tests
- **Planned at**: commit `37e12dee`, 2026-06-29

## Why this matters

HTTP tests cover webhook signature; `applyBillingSubscriptionEvent` tier mapping and idempotency need direct action tests.

## Current state

- `packages/backend/convex/subscriptions.ts:536-645` — `applyBillingSubscriptionEvent` internalAction
- `subscriptions.test.ts` covers `upsertOrganizationSubscription`, `claimPolarWebhook`
- `http-polar.test.ts` covers HTTP boundary

## Commands

| Purpose | Command | Expected |
|---------|---------|----------|
| Subscriptions tests | `cd packages/backend && bun run test subscriptions.test.ts http-polar.test.ts` | pass |
| Full backend | `cd packages/backend && bun run test` | pass |
| Gates | `bun run typecheck && bun run lint` | exit 0 |

## Scope

**In scope**: `packages/backend/convex/subscriptions.test.ts` or `packages/backend/tests/subscriptions-billing.test.ts`

**Out of scope**: Live Polar API; changing billing logic

## Git workflow

- Branch: `advisor/048-test-apply-billing-subscription-event`
- Commit: `test(subscriptions): cover applyBillingSubscriptionEvent`

## Steps

### Step 1: Build fixture payload

Match `polarWebhookSubscriptionValidator` at `subscriptions.ts:81+`. Include `webhookId`, `eventType`, `organizationId` in metadata, `productName`, `status`, period fields.

Register polar component if needed (see `http-polar.test.ts`).

### Step 2: Table-driven tests via t.action

1. Valid subscription.updated → org tier updated, `organizationSubscriptions` row, `{ processed: true }`
2. Duplicate webhookId → `{ processed: false }` (claim rejected)
3. Unknown organizationId → `{ processed: true }` without tier change (warn path)

### Step 3: Full gates

## Done criteria

- [ ] ≥3 meaningful tests calling `internal.subscriptions.applyBillingSubscriptionEvent`
- [ ] No network calls
- [ ] Full suite passes

## STOP conditions

- Action requires env vars unavailable in test — stub and document

## Maintenance notes

Extend when new event types added to handler.
