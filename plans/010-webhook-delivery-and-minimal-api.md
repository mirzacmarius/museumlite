# Plan 010: Deliver outbound webhooks and a minimal key-authenticated read API

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6e3f1d1a..HEAD -- packages/backend/convex/webhooks.ts packages/backend/convex/webhooksActions.ts packages/backend/convex/http.ts packages/backend/convex/apiKeys.ts packages/backend/convex/collections.ts packages/backend/convex/loans.ts packages/backend/convex/media.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: L (Phase A: M, Phase B: M)
- **Risk**: MED (Phase B touches an authenticated HTTP surface — HIGH if scoped beyond read-only)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `6e3f1d1a`, 2026-06-12

## Why this matters

The product ships a Developer settings page with **Webhooks** and **API Keys** tabs
(`apps/app/src/app/[locale]/(dashboard)/settings/developer/page.tsx`), implying an
integration platform. Neither half works: webhooks define twelve event types but the
only outbound HTTP call ever made is a manual *test* ping, and API keys can be created,
listed, and revoked but authenticate nothing — `apiKeys.validate` is an
`internalMutation` no HTTP route calls, and `http.ts` exposes only auth + two Polar
billing webhooks. Integrators who configure either surface get silently nothing. This
plan makes both real at minimal scope: actually deliver webhooks for an initial set of
events (Phase A), and add one key-authenticated read-only REST endpoint that proves
the API-keys surface (Phase B).

## Current state

- `packages/backend/convex/webhooks.ts` — webhook CRUD (create/list/update/delete,
  secret generation, `updateLastTriggered` internal mutation). Event catalog:

```13:25:packages/backend/convex/webhooks.ts
const WEBHOOK_EVENTS = [
  "collection.created",
  "collection.updated",
  "collection.deleted",
  "loan.created",
  "loan.approved",
  "loan.dispatched",
  "loan.returned",
  "accession.created",
  "accession.approved",
  "accession.cataloged",
  "media.uploaded",
] as const;
```

- `packages/backend/convex/webhooksActions.ts` — Node-runtime action file containing
  only `test` (manual test delivery). It already implements HMAC signing you must
  reuse:

```107:123:packages/backend/convex/webhooksActions.ts
async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload),
  );
  const hashArray = Array.from(new Uint8Array(signature));
  return `sha256=${hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}
```

  The test action sends headers `X-ML-Signature` and `X-ML-Event` (lines 79-87) —
  real deliveries must use the same envelope so integrators verify one way.

- `packages/backend/convex/http.ts` — only routes are Convex auth plus
  `/polar/events` (line 192) and `/integrations/polar/webhook` (line 198). Read this
  file before Phase B; it shows the repo's `httpAction` + router pattern.
- `packages/backend/convex/apiKeys.ts` — `validate` is internal and returns org +
  permissions on success:

```213:231:packages/backend/convex/apiKeys.ts
export const validate = internalMutation({
  args: {
    apiKey: v.string(),
  },
  returns: v.union(
    v.object({
      valid: v.literal(true),
      organizationId: v.id("organizations"),
      permissions: v.array(v.string()),
      keyId: v.id("apiKeys"),
    }),
    v.object({
      valid: v.literal(false),
    }),
  ),
  handler: async (ctx, args) => {
    const keyHash = await hashKey(args.apiKey);
    const prefix = args.apiKey.substring(0, 10);
```

- Repo conventions: actions needing Node APIs live in separate files (see the comment
  at `webhooksActions.ts:6-10`); scheduled work uses `ctx.scheduler.runAfter(0, internal.…)`
  and **never** schedules public `api.*` functions; all functions declare `args`/`returns`
  validators. Tests: `packages/backend/tests/`, harness `testHarness.ts`, exemplar
  `conservation.test.ts`.

## Commands you will need

| Purpose   | Command (repo root unless noted)                  | Expected on success |
|-----------|---------------------------------------------------|---------------------|
| Lint      | `bun run lint`                                    | exit 0              |
| Typecheck | `bun run typecheck`                               | exit 0              |
| Tests     | `cd packages/backend && bunx vitest run webhooks apiKeys` | all pass    |
| All tests | `cd packages/backend && bun test:once`            | all pass            |

## Scope

**In scope** (the only files you should modify/create):
- `packages/backend/convex/webhooks.ts` (internal query for active hooks by org+event)
- `packages/backend/convex/webhooksActions.ts` (add `deliver` internal action)
- `packages/backend/convex/utils/webhookEvents.ts` (create — shared `emitWebhookEvent` helper)
- Emit-point mutations, **exactly three**: `collections.ts` (create), `loans.ts`
  (the approve mutation), `media.ts` (the upload-complete/create mutation)
- `packages/backend/convex/http.ts` (Phase B: one new route)
- `packages/backend/tests/webhooks.test.ts`, `packages/backend/tests/apiKeys.test.ts` (extend/create)

**Out of scope** (do NOT touch):
- The remaining eight webhook events — wire only `collection.created`,
  `loan.approved`, `media.uploaded`. The helper makes the rest one-line follow-ups.
- Delivery retries, dead-letter queues, per-delivery history tables — fire-and-forget
  with `lastTriggeredAt` update is the v1; record this in maintenance notes.
- Any write/mutation REST endpoint. Phase B is **read-only GET**.
- The developer settings UI — it already lists/creates both resources correctly.
- Rate limiting infrastructure — apply the simple per-request cap described in Phase B.

## Git workflow

- Branch: `advisor/010-webhooks-and-api`
- Conventional commits, e.g. `feat(webhooks): deliver events from collection/loan/media mutations`
- Do NOT push or open a PR unless the operator instructed it.

## Steps — Phase A: webhook delivery

### Step A1: Internal query for matching webhooks

In `webhooks.ts`, add `internalQuery` `getActiveForEvent` with args
`{ organizationId: v.id("organizations"), event: v.string() }`, returning an array of
`{ _id, url, secret }` for webhooks where `isActive === true` and `events` contains
the event. Check `schema.ts` for the webhooks table's indexes; query via the
organization index and filter the (small) result in TypeScript.

**Verify**: `bun run typecheck` → exit 0.

### Step A2: `deliver` internal action

In `webhooksActions.ts`, add `internalAction` `deliver` with args
`{ organizationId, event: v.string(), data: v.any() }`:
- `ctx.runQuery(internal.webhooks.getActiveForEvent, …)`.
- For each hook: build `{ event, timestamp: Date.now(), data }`, sign with the existing
  `signPayload`, POST with the same `X-ML-Signature` / `X-ML-Event` headers as `test`,
  wrap fetch in try/catch (a failing endpoint must never throw out of the action), and
  on success `ctx.runMutation(internal.webhooks.updateLastTriggered, { webhookId })`.
- Reject non-HTTPS URLs at delivery time (`if (!url.startsWith("https://")) continue;`)
  — defense-in-depth even if creation already validates.

**Verify**: `bun run typecheck` → exit 0.

### Step A3: Emit helper + three emit points

Create `packages/backend/convex/utils/webhookEvents.ts`:

```typescript
import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export async function emitWebhookEvent(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  event: string,
  data: Record<string, unknown>,
): Promise<void> {
  await ctx.scheduler.runAfter(0, internal.webhooksActions.deliver, {
    organizationId,
    event,
    data,
  });
}
```

Call it from exactly three mutations (locate each by reading the file — names below
are the expected exports; if a name differs, find the equivalent by its audit-log
action string):
1. `collections.ts` — the object-creation mutation (likely `create`): emit
   `collection.created` with `{ collectionId, title }` after the insert.
2. `loans.ts` — the loan-approval mutation: emit `loan.approved` with `{ loanId }`.
3. `media.ts` — the media-creation mutation: emit `media.uploaded` with `{ mediaId }`.

Keep payloads to IDs + one display field — no full documents (avoids leaking
fields added later).

**Verify**: `bun run typecheck` → exit 0; `bun run lint` → exit 0.

### Step A4: Phase A tests

In `packages/backend/tests/webhooks.test.ts` (extend if it exists, else create using
the `conservation.test.ts` harness pattern):
1. `getActiveForEvent` returns only active webhooks subscribed to the event.
2. Creating a collection schedules a delivery: use `convex-test`'s scheduler support —
  after the mutation, `t.finishInProgressScheduledFunctions()` (or assert via
  `t.run` that a scheduled function exists) and mock `fetch` via
  `vi.stubGlobal("fetch", …)` to assert the POST body has `event: "collection.created"`
  and an `X-ML-Signature` header.

If scheduler+fetch mocking proves unsupported by the installed `convex-test` version,
test `getActiveForEvent` and the signing envelope directly and note the gap in the
plan's README row — do not fight the harness for more than two attempts.

**Verify**: `cd packages/backend && bunx vitest run webhooks` → all pass.

## Steps — Phase B: minimal read-only REST endpoint

### Step B1: Route `GET /v1/objects`

In `http.ts`, add a route following the existing `httpAction` pattern:
- Auth: `Authorization: Bearer <key>` header → `ctx.runMutation(internal.apiKeys.validate, { apiKey })`.
  Missing/invalid → `401` JSON `{ "error": "invalid_api_key" }`.
- Permission: validated key's `permissions` must include `"read"` (inspect the
  permissions vocabulary used by the API-keys create path in `apiKeys.ts` /
  `api-keys-tab.tsx` and use its read-level value; if no read-level permission exists,
  accept any valid key and note it).
- Data: add an `internalQuery` in `collections.ts` (e.g. `listForApi`) returning at
  most 50 objects for the key's `organizationId` via the organization index —
  id, title, status, createdAt only. The HTTP handler must use the org ID **from the
  validated key**, never from request params (no cross-tenant reach).
- Response: `200` JSON `{ "data": [...] }`.

**Verify**: `bun run typecheck` → exit 0.

### Step B2: Phase B tests

In `packages/backend/tests/apiKeys.test.ts` (extend or create): `convex-test` supports
HTTP actions via `t.fetch("/v1/objects", { headers })`. Cover:
1. No auth header → 401.
2. Revoked key → 401.
3. Valid key → 200 and only that organization's objects are returned (create two orgs
   to prove isolation).

**Verify**: `cd packages/backend && bunx vitest run apiKeys` → all pass.

### Step B3: Full gates

**Verify**: `bun run lint` → exit 0; `bun run typecheck` → exit 0;
`cd packages/backend && bun test:once` → all pass.

## Test plan

Covered in A4 and B2. Pattern: `packages/backend/tests/conservation.test.ts` for
harness/permissions; `t.fetch` for HTTP actions.

## Done criteria

- [ ] `bun run lint`, `bun run typecheck` exit 0; `bun test:once` passes
- [ ] `grep -n "emitWebhookEvent" packages/backend/convex/collections.ts packages/backend/convex/loans.ts packages/backend/convex/media.ts` → 3 matches total
- [ ] `grep -n "deliver" packages/backend/convex/webhooksActions.ts` → internal action exists
- [ ] `grep -n "/v1/objects" packages/backend/convex/http.ts` → 1 route
- [ ] Tenant-isolation test (two orgs, one key) exists and passes
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- A delivery/emit mechanism already exists (search `emitWebhook|dispatchWebhook|deliver`
  in `packages/backend/convex/` first — if found, the codebase drifted past this plan).
- The three emit-point mutations cannot be identified unambiguously in
  `collections.ts` / `loans.ts` / `media.ts`.
- `apiKeys.validate`'s return shape differs from the excerpt above.
- Phase B appears to require new schema tables, rate-limiter infrastructure, or
  changes to key creation — that's scope growth; report instead.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **Deferred deliberately**: delivery retries/history (a `webhookDeliveries` table is
  the natural v2), the remaining eight events (one `emitWebhookEvent` call each),
  outbound-URL allowlisting/private-IP blocking (Convex actions egress from cloud
  infra; revisit if self-hosting), and rate limiting on `/v1/objects` (add
  `@convex-dev/ratelimiter` when a second endpoint appears).
- Reviewer focus: the emit calls must be **after** the DB write and must not change
  mutation return values; the HTTP handler must take the org from the key, not the query string.
- Security follow-up already on record (plans/README "considered and rejected", SEC-10):
  `apiKeys.validate` uses non-constant-time hash comparison — worth fixing while in this file if trivial.
