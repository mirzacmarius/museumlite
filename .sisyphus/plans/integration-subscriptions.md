# Integration Subscriptions Plan

## Goal
Implement org‑scoped paid integrations with subscribe‑on‑activate, auto‑enable after checkout, and entitlement lasting through current period end even after cancel. No backend errors exposed to users.

## Decisions
- Product IDs: **env‑backed constants** in Convex config (best for per‑env mapping).
- Scope: **organization**.
- Activation: **subscribe modal on toggle**, auto‑enable after subscription becomes active.
- Cancellation: access continues until `currentPeriodEnd`, even if canceled.

## Research Summary (Existing Patterns)
- Integrations toggled in `apps/app/src/app/[locale]/(dashboard)/settings/integrations/page.tsx` via `api.integrations.enable/disable`.
- Sidebar gating uses lock icons and `useFeatureAccess` in `apps/app/src/components/app-sidebar.tsx`.
- Polar subscription data stored in component schema; webhooks already registered in `packages/backend/convex/http.ts`.
- `@convex-dev/polar` checkout link does not expose metadata; direct SDK usage required for metadata.

## Phase 1 — Data Model & Entitlements [COMPLETED]
1. [x] Add `integrationSubscriptions` table to Convex schema:
   - Fields: `organizationId`, `integrationId`, `productId`, `subscriptionId`, `customerId`, `status`, `cancelAtPeriodEnd`, `currentPeriodEnd`, `metadata`, `updatedAt`.
   - Indexes: `by_organization`, `by_organization_and_integration`, `by_subscription`, `by_status`.
2. [x] Add helper query `isIntegrationSubscribed(organizationId, integrationId)`:
   - Active if `status === "active"` OR (`cancelAtPeriodEnd` and `currentPeriodEnd > now`).
3. [x] Add `requiresSubscription(integrationId)` query.
4. [x] Add `getSubscription(organizationId, integrationId)` query.

## Phase 2 — Checkout + Metadata [COMPLETED]
1. [x] Add action `integrations.createCheckoutLink`:
   - Args: `organizationId`, `integrationId`, `successUrl`.
   - Uses Polar SDK directly to create checkout with metadata: `{ organizationId, integrationId }`.
   - Returns checkout URL.
2. [x] Product ID loaded from env var `INTEGRATION_PRODUCT_{INTEGRATION_ID}` (e.g., `INTEGRATION_PRODUCT_LIBRARY`).

## Phase 3 — Webhook Sync [COMPLETED]
1. [x] Added separate webhook endpoint at `/integrations/polar/webhook`:
   - On subscription create/update/canceled:
     - Read metadata orgId + integrationId.
     - Upsert `integrationSubscriptions` for that org + integration.
   - Preserve end‑of‑period access by storing `currentPeriodEnd` + `cancelAtPeriodEnd`.
2. [x] Added `upsertIntegrationSubscription` internal mutation.

## Phase 4 — Backend Enforcement [COMPLETED]
1. [x] Update `integrations.enable` mutation:
   - If paid and not subscribed → return `{ ok: false, reason: "subscription_required" }` (no throw).
   - If subscribed → enable and init defaults.
2. [x] Add `integrations.getSubscription` query (org + integration) for UI status.

## Phase 5 — Frontend UX [COMPLETED]
1. [x] Settings → Integrations:
   - Toggle click when unsubscribed opens **Subscribe modal**.
   - Uses `createCheckoutLink` action to redirect to Polar checkout with metadata.
   - Shows subscription status (Canceling badge, access-until date).
2. [x] Sidebar:
   - Show integration nav only when **enabled + entitled**.
3. [x] Integration pages:
   - Guard content with entitlement; show upgrade state if not entitled.
4. [x] After checkout return: auto-enable integration via `?subscribed=` param.

## Phase 6 — Migration & QA [PARTIALLY COMPLETED]
1. [x] One‑off backfill action:
   - `internal.integrations.backfillIntegrationSubscriptions({ integrationId?, dryRun? })`
   - Matches enabled org integrations to user subscriptions by product ID.
2. [ ] QA scenarios:
   - No subscription → toggle opens modal, no error.
   - Subscribe → entitlement true → auto‑enable.
   - Cancel subscription → access until period end.
   - Sidebar hides when entitlement false.

## Risks / Open Items
- If metadata cannot be passed through `@convex-dev/polar`, use Polar SDK directly.
- Product mapping must be set for each integration + interval.

## Acceptance Criteria
- No backend error surfaced when toggling unsubscribed integrations.
- Subscribed integrations can be enabled and used.
- Entitlement persists through subscription end date.
- Sidebar and pages reflect entitlement accurately.
