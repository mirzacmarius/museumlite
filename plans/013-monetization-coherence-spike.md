# Plan 013: Monetization coherence — decision memo plus mechanical billing fixes

> **Executor instructions**: This is a **spike/decision plan**, not a pure build plan.
> Steps 1–3 are mechanical and safe to execute. Step 4 produces a decision memo for
> the maintainer — it does NOT implement tier changes. Follow the plan step by step,
> run every verification command, and honor the STOP conditions. When done, update
> the status row in `plans/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8a341d62..HEAD -- packages/backend/convex/utils/featurePolicy.ts packages/backend/convex/utils/featureGates.ts packages/backend/convex/integrations.ts packages/backend/convex/organizations.ts packages/backend/convex/email apps/app/src/app/[locale]/\(dashboard\)/settings`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M (mechanical steps S–M; memo M)
- **Risk**: LOW for steps 1–3 (no entitlement behavior changes); the memo defers the risky part to the maintainer
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `6e3f1d1a`, 2026-06-12 — **reconciled** against `main` @ `8a341d62`, 2026-06-12 (finding unchanged; drift baseline updated after unrelated settings/data import work from Plan 012)
- **Execute refresh**: 2026-06-12 — first executor stopped before edits because the Polar webhook subscription payload contains `customerId` but no customer email. The refreshed plan keeps the same scope and allows a repo-local internal lookup of the organization's billing recipient email from `organizations.ownerUserId` → `users.email`; it still forbids external customer/email lookups.
- **Executed**: 2026-06-12 in `/Users/marius/Developer/ml-worktrees/advisor-013-monetization` on branch `advisor/013-monetization-coherence` @ `93c29a34`; reviewed and approved. Verification: `bun run lint`, `bun run typecheck`, `cd packages/backend && bunx vitest run subscriptions` (2 files, 12 tests), and `cd packages/backend && bun test:once` (79 files, 820 tests) all passed.
- **Reconciled 2026-06-12**: work is **not on `main`** @ `8a341d62` — no open PR. Index status is IN PROGRESS until merge. On `main`, done criteria still fail: Stripe link at `settings/billing/page.tsx:117`, missing `docs/decisions/monetization-coherence.md`, no `sendSubscriptionSuccessEmail` wiring in `subscriptions.ts`.

## Why this matters

Billing works (Polar checkout, customer portal, webhook → tier sync) but the
monetization model around it is incoherent, and the incoherence grows with every new
module. Three layers disagree: (1) seven features are tier-gated while nine modules
toggle on free of charge with no tier check; (2) a complete per-integration billing
pipeline (checkout action, webhook route, `integrationSubscriptions` table, subscribe
dialog) exists but `PAID_INTEGRATIONS` is empty and the dialog is dead code; (3) the
whole revenue path rides on a forked alpha package, the billing help UI links to
**Stripe** docs although the stack is Polar, and subscription success/error emails
exist but are never sent. This plan fixes the unambiguous parts mechanically and
produces a one-page decision memo so the maintainer can settle the module-vs-tier
question deliberately instead of by accretion.

## Current state

- **Tier gates** — `packages/backend/convex/utils/featurePolicy.ts`:

```37:45:packages/backend/convex/utils/featurePolicy.ts
export const FEATURE_REQUIREMENTS: Record<FeatureId, SubscriptionTier> = {
  loans: "pro",
  exhibitions: "pro",
  conservation: "pro",
  reporting: "pro",
  public_portal: "pro",
  installations: "pro",
  compliance: "enterprise",
};
```

- **Module toggles bypass tiers** — `utils/featureGates.ts`:

```27:38:packages/backend/convex/utils/featureGates.ts
function hasOrganizationModuleEnabled(
  org: Doc<"organizations">,
  moduleId: ModuleId,
): boolean {
  const enabledModules = org.settings?.enabledModules ?? [];
  if (enabledModules.includes(moduleId)) {
    return true;
  }

  const enabledIntegrations = org.settings?.enabledIntegrations ?? [];
  return moduleId === "library" && enabledIntegrations.includes("library");
}
```

  The modules settings page (`apps/app/src/app/[locale]/(dashboard)/settings/modules/page.tsx:79-91`)
  writes `enabledModules` via `api.organizations.update`, and `organizations.ts`'s
  `update` (lines ~628-633) merges `settings` with **no tier check**. The module
  catalog is `utils/moduleCatalog.ts` (library, fine_art, wine, inventory_valuation, etc.).

- **Vestigial integration billing** — `integrations.ts:36` sets
  `requiresSubscription: false` for library (the only integration), `:41` declares
  `PAID_INTEGRATIONS = [] as const`, yet `createCheckoutLink` (~line 416-468), the
  `integrationSubscriptions` schema table, the `/integrations/polar/webhook` HTTP route
  (`http.ts:198`), and a subscribe dialog in
  `settings/integrations/page.tsx` all exist. The dialog's `handleSubscribe`
  (page.tsx:424-449) doesn't even start a checkout — it calls plain `enableIntegration`
  — and nothing ever opens the dialog.
- **Alpha fork** — `packages/backend/package.json:20`:
  `"@convex-dev/polar": "npm:@erquhart/convex-polar@0.2.0-alpha.5"`.
- **Stripe link on a Polar stack** — `apps/app/src/app/[locale]/(dashboard)/settings/billing/page.tsx`
  (~lines 114-123) links test-card help to Stripe docs.
- **Unwired billing emails** — `packages/backend/convex/email/actions.ts`:

```98:120:packages/backend/convex/email/actions.ts
export const sendSubscriptionSuccessEmailAction = internalAction({
  args: {
    email: v.string(),
    subscriptionId: v.string(),
  },
  returns: v.null(),
  handler: async (_ctx, args) => {
    await sendSubscriptionSuccessEmail(args);
    return null;
  },
});

export const sendSubscriptionErrorEmailAction = internalAction({
  args: {
    email: v.string(),
    subscriptionId: v.string(),
  },
  returns: v.null(),
  handler: async (_ctx, args) => {
    await sendSubscriptionErrorEmail(args);
    return null;
  },
});
```

  Repo-wide, nothing calls either action (`rg sendSubscriptionSuccessEmailAction packages/backend/convex --files-with-matches` → only `email/actions.ts`).
  Subscription state sync happens in `packages/backend/convex/subscriptions.ts`
  (Polar checkout creation ~line 620-668; find the webhook-driven upsert path by
  reading the file and `http.ts:192`'s `/polar/events` handler).
- **Billing recipient source** — the Polar webhook subscription payload has
  `customerId` but no email. Do **not** query Polar just to send this email. Instead,
  use repo-local data: `organizations.ownerUserId` is optional in `schema.ts`, and
  `users.email` is optional on the user row. Add a small internal helper in
  `subscriptions.ts` that reads the organization and owner user, returning
  `{ email: string } | null`; schedule the success email only when this helper returns
  a non-empty email. If the organization has no owner email, continue the billing sync
  and record the skipped email in the memo/report rather than failing the webhook.
- Conventions: scheduled work targets `internal.*` only; conventional commits;
  tests in `packages/backend/tests/` with `testHarness.ts`.

## Commands you will need

| Purpose   | Command (repo root unless noted)              | Expected on success |
|-----------|-----------------------------------------------|---------------------|
| Lint      | `bun run lint`                                | exit 0              |
| Typecheck | `bun run typecheck`                           | exit 0              |
| Tests     | `cd packages/backend && bunx vitest run subscriptions` | all pass    |
| All tests | `cd packages/backend && bun test:once`        | all pass            |

## Scope

**In scope** (the only files you should modify/create):
- `apps/app/src/app/[locale]/(dashboard)/settings/billing/page.tsx` (doc link only)
- `packages/backend/convex/subscriptions.ts` (schedule subscription email actions; add a repo-local internal helper if needed to resolve the organization's owner email)
- `packages/backend/tests/subscriptions.test.ts` (extend/create)
- `docs/decisions/monetization-coherence.md` (create — the memo)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch — these await the maintainer's decision):
- `featurePolicy.ts`, `featureGates.ts`, `moduleCatalog.ts` — no tier/module gating changes.
- `integrations.ts`, the subscribe dialog, `integrationSubscriptions` schema, the Polar
  integration webhook — deleting or wiring them is Option B/C in the memo, not this plan.
- The `@convex-dev/polar` fork/version — upgrading is a separate migration task; the
  memo documents the risk.
- `organizations.ts` `update` — adding tier enforcement to `enabledModules` is the
  memo's headline question.

## Git workflow

- Branch: `advisor/013-monetization-coherence`
- Conventional commits, e.g. `fix(billing): link Polar test docs instead of Stripe`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Fix the Stripe → Polar doc link

In `settings/billing/page.tsx` (~lines 114-123), replace the Stripe test-card link
with Polar's sandbox/testing documentation: `https://docs.polar.sh/integrate/sandbox`.
Update the surrounding copy if it says "Stripe".

**Verify**: `rg -i 'stripe' apps/app/src/app/\[locale\]/\(dashboard\)/settings/billing/` → no matches. `bun run lint` → exit 0.

### Step 2: Wire subscription lifecycle emails

In `subscriptions.ts`, locate where a subscription becomes active after checkout/webhook
(the upsert that sets the org's `subscriptionTier` — read the file; also check the
`/polar/events` handler in `http.ts` if the upsert lives behind it).

The webhook payload does not include customer email. Add a small internal helper in
`subscriptions.ts` if one does not already exist, for example
`getOrganizationBillingEmail`, that:

1. accepts `organizationId: v.id("organizations")`,
2. reads the organization,
3. reads `organization.ownerUserId` from `users`,
4. returns `v.union(v.object({ email: v.string() }), v.null())`,
5. returns `null` if the organization, owner, or owner email is missing.

Do not query Polar, Clerk/Auth, or any other external system just to send this email.
At the successful entitled subscription point, call that helper and schedule the
success email only when it returns an email:

```typescript
const billingEmail = await ctx.runQuery(
  internal.subscriptions.getOrganizationBillingEmail,
  { organizationId },
);
if (billingEmail) {
  await ctx.scheduler.runAfter(
    0,
    internal.email.actions.sendSubscriptionSuccessEmailAction,
    {
      email: billingEmail.email,
      subscriptionId,
    },
  );
}
```

Use the actual subscription id variable at that point (likely `args.id` in the webhook
action or `subscription.id` in the manual sync action). Only schedule success for an
entitled subscription (`isEntitled` / active access), not for cancellation or revoked
events. Wire the error action only if there is already a clear non-entitled failure path
with a repo-local recipient email; otherwise leave error email unwired and say so in the
memo. Missing owner email is not a STOP condition; the billing sync must still complete.

**Verify**: `bun run typecheck` → exit 0;
`rg "sendSubscriptionSuccessEmailAction" packages/backend/convex --files-with-matches` → ≥2 files.

### Step 3: Smoke test for webhook → tier sync

In `packages/backend/tests/subscriptions.test.ts` (extend if present, else create with
the `testHarness.ts` pattern): drive whatever internal mutation/action the Polar event
handler calls to upsert a subscription (read `http.ts:192`'s handler to find it), then
assert the organization's `subscriptionTier` becomes `pro`. Add coverage for the
repo-local billing email helper: owner email present returns `{ email }`; missing owner
or owner email returns `null`. Assert an email action was scheduled if the harness can
inspect scheduled functions; if it cannot, skip only the scheduler assertion and note
which.

**Verify**: `cd packages/backend && bunx vitest run subscriptions` → all pass.

### Step 4: Decision memo

Create `docs/decisions/monetization-coherence.md` (~one page). Required content —
all facts are in "Current state" above; restate them, do not re-audit:

1. **The inconsistency**, concretely: a free org can enable library/fine_art/
   inventory_valuation etc. from Settings → Modules, while loans/exhibitions/portal
   show a Pro paywall in the same sidebar.
2. **Options table** with one-line cost/risk each:
   - **A. Modules stay free** — they're catalog *flavors*, tiers gate *workflows*.
     Cheapest; document it and delete the integration-billing machinery.
   - **B. Map modules to tiers** — add a `MODULE_REQUIREMENTS` map beside
     `FEATURE_REQUIREMENTS` and enforce in `organizations.update`; grandfather
     existing orgs (migration listing orgs with now-gated modules enabled).
   - **C. Modules as paid add-ons** — populate `PAID_INTEGRATIONS`, wire the subscribe
     dialog to `createCheckoutLink`; most machinery already exists but doubles the
     billing surface to maintain.
3. **Recommendation** (state one; A is the advisor's default given current customer
   count — say why in two sentences).
4. **Fork risk paragraph**: `@erquhart/convex-polar@0.2.0-alpha.5` vs upstream
   `@convex-dev/polar` — record current upstream version (check npm), and what to
   smoke-test on any bump (the Step 3 test is exactly that).
5. **Email wiring note**: success emails use the organization owner email from the
   local database because Polar subscription webhooks carry `customerId` but not email.
   If an organization has no owner email, billing sync still succeeds and the email is
   skipped. Error emails remain unwired unless/until a clear local recipient and failure
   event are defined.
6. **Dead-code inventory** to delete under Option A: subscribe dialog state +
   `handleSubscribe` (`settings/integrations/page.tsx`), `createCheckoutLink`,
   `requiresSubscription` plumbing, `/integrations/polar/webhook` route,
   `integrationSubscriptions` table (schema change — flag it).

**Verify**: file exists; `bun run lint` → exit 0 (lint covers markdown via Biome? if
not, no-op). A human can read the memo and pick A/B/C without opening any code.

### Step 5: Full gates

**Verify**: `bun run lint` → exit 0; `bun run typecheck` → exit 0;
`cd packages/backend && bun test:once` → all pass.

## Test plan

Step 3 only (this plan deliberately avoids entitlement behavior changes). Pattern:
existing `packages/backend/tests/` harness usage.

## Done criteria

- [ ] No Stripe references under `settings/billing/`
- [ ] `sendSubscriptionSuccessEmailAction` referenced from `subscriptions.ts` (or the webhook handler path) — `rg` shows ≥2 files
- [ ] Webhook→tier smoke test exists and passes
- [ ] `docs/decisions/monetization-coherence.md` exists with options A/B/C and a recommendation
- [ ] `bun run lint`, `bun run typecheck` exit 0; `bun test:once` passes
- [ ] No entitlement behavior changed: `git diff --stat` shows no edits to `featurePolicy.ts`, `featureGates.ts`, `moduleCatalog.ts`, `integrations.ts`
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The subscription-activation point in `subscriptions.ts`/`http.ts` cannot be
  identified unambiguously.
- There is no repo-local path to resolve a billing recipient email from the
  organization/owner user without external queries.
- The Polar component's API makes the Step 3 test require network access (tests must
  stay hermetic) — write the memo and doc-link fix, report the test as blocked.
- You find tier enforcement on `enabledModules` already exists (drift) — the memo's
  premise changed; report.

## Maintenance notes

- The memo is the deliverable that prevents drift: whichever option the maintainer
  picks becomes a follow-up build plan (B and C are each a plan of their own).
- Reviewer focus: Step 2 must not change the webhook handler's success/failure
  semantics — email scheduling failures must not fail the sync (scheduler calls are
  fire-and-forget by design, but confirm no `await`-and-throw pattern wraps them).
- Related deferred item from the earlier audit (plans/README rejected list, SEC-09):
  the integrations webhook secret falls back to the shared Polar secret — if Option A
  deletes that route, SEC-09 closes for free.
