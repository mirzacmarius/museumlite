# Plan 021: Generate webhook signing secrets with cryptographic randomness

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8a341d62..HEAD -- packages/backend/convex/webhooks.ts packages/backend/convex/apiKeys.ts packages/backend/tests/webhooks.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `8a341d62`, 2026-06-19

## Why this matters

Webhook signing secrets authenticate outbound webhook payloads. They should be
generated with the same cryptographic randomness standard as API keys.
Currently API keys use `crypto.getRandomValues`, while webhook secrets use
`Math.random()`.

## Current state

- `packages/backend/convex/webhooks.ts` uses `Math.random()`.

```text
webhooks.ts:27 function generateSecret(): string {
webhooks.ts:31 for (let i = 0; i < 32; i++) {
webhooks.ts:32   secret += chars.charAt(Math.floor(Math.random() * chars.length));
```

- `packages/backend/convex/apiKeys.ts` already uses Web Crypto.

```text
apiKeys.ts:11 const randomValues = new Uint32Array(37);
apiKeys.ts:12 crypto.getRandomValues(randomValues);
apiKeys.ts:16 key += chars.charAt(randomValue % chars.length);
```

Prior rejected finding SEC-10 notes modulo bias in API keys; this plan should
avoid copying that bias if the code can stay simple.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Target tests | `cd packages/backend && bunx vitest run webhooks` | pass |
| Typecheck | `bun run typecheck` | exit 0 |
| Lint | `bun run lint` | exit 0 |

## Scope

**In scope**:
- `packages/backend/convex/webhooks.ts`
- `packages/backend/tests/webhooks.test.ts`

**Out of scope**:
- Rotating existing webhook secrets automatically.
- Changing API key generation.
- Delivery/retry behavior.

## Git workflow

- Branch: `advisor/021-crypto-webhook-secrets`
- Commit message example: `fix(webhooks): use crypto randomness for secrets`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Replace `Math.random()` generation

Implement a small helper using `crypto.getRandomValues`. Prefer rejection
sampling to avoid modulo bias:

- alphabet length is 62;
- generate random bytes;
- accept a byte only if it is less than `Math.floor(256 / 62) * 62`;
- append `chars[byte % 62]` until 32 characters are produced;
- keep `whsec_` prefix.

Do not import Node `crypto`; Convex runtime exposes Web Crypto.

**Verify**: `bun run typecheck` -> exit 0.

### Step 2: Add a regression test

In `packages/backend/tests/webhooks.test.ts`, create a webhook and assert:

- returned secret starts with `whsec_`;
- length is unchanged from current behavior;
- secret is not stored or returned by `list`;
- `get` still returns the secret only for authorized manage-settings callers
  if that behavior is already tested.

Do not snapshot or log secret values.

**Verify**: `cd packages/backend && bunx vitest run webhooks` -> pass.

### Step 3: Full verification

Run:

```bash
bun run typecheck
bun run lint
```

Both must exit 0.

## Test plan

Add one focused creation test for secret shape and non-disclosure through list.
No randomness quality statistical test is required.

## Done criteria

- [ ] `webhooks.ts` contains no `Math.random()` usage.
- [ ] Webhook secrets keep the same prefix/length contract.
- [ ] Target tests, typecheck, and lint pass.
- [ ] `plans/README.md` status row updated.

## STOP conditions

- Convex runtime for this file does not support `crypto.getRandomValues`.
- Existing tests or UI require a different secret length/shape.
- A cited excerpt no longer matches live code.

## Maintenance notes

Consider a later ops note to rotate existing webhook secrets if any were created
before this change and used for production integrations.
