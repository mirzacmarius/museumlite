# Monetization Coherence

MuseumLite currently mixes two monetization models. A free organization can enable modules such as library, fine_art, and inventory_valuation from Settings -> Modules, while workflows such as loans, exhibitions, reporting, public portal, installations, and compliance show Pro or Enterprise gates in the same product surface. That may be intentional, but it is not documented, and the integration add-on billing path makes the intent harder to infer.

## Options

| Option | Description | Tradeoff |
| --- | --- | --- |
| A. Modules stay free | Treat modules as catalog flavors and keep tiers focused on workflows. | Cheapest path: document the policy and delete integration-billing machinery that no longer has a product role. |
| B. Map modules to tiers | Add `MODULE_REQUIREMENTS` beside `FEATURE_REQUIREMENTS`, enforce it in `organizations.update`, and grandfather existing organizations. | Clearer entitlement model, but introduces migration work and customer communication risk. |
| C. Modules as paid add-ons | Populate `PAID_INTEGRATIONS` and wire the subscribe dialog to `createCheckoutLink`. | Reuses much of the existing machinery, but doubles the billing surface area and support burden. |

## Recommendation

Choose Option A for now. Given the current customer count, paid workflow gates are enough pricing leverage, and keeping modules free avoids introducing a second entitlement model before there is evidence that module-level willingness to pay exists.

## Fork Risk

The backend currently pins `@convex-dev/polar` through the fork alias `npm:@erquhart/convex-polar@0.2.0-alpha.5`. The current upstream `@convex-dev/polar` version is `0.9.1` as checked with `npm view @convex-dev/polar version` on 2026-06-12. Before any bump, smoke-test checkout creation, webhook processing, and organization tier sync.

## Billing Email Wiring

Polar subscription webhooks carry `customerId` but not the customer email. Subscription success emails therefore use the local organization owner email via `organizations.ownerUserId` -> `users.email`; if the organization, owner, or owner email is missing, billing sync still succeeds and the email is skipped. No error email is wired yet because there is no clear repo-local non-entitled failure path with a recipient email.

## Dead Code Under Option A

If modules stay free, delete the unused integration add-on billing path: subscribe dialog state and `handleSubscribe`, `createCheckoutLink`, `requiresSubscription` plumbing, the `/integrations/polar/webhook` route, and the `integrationSubscriptions` table.
