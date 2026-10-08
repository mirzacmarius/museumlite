# MUS-655 re-review

Branch `codex/mus-655-recovery` at `d9d42167`. Reviewed `git diff c3ac1185..HEAD` (fix commits) against `MUS-655-review.md`, and `git diff origin/main...HEAD` for new problems. Library internals checked against the installed `@convex-dev/auth` 0.0.95 (`dist/server/implementation/mutations/{createVerificationCode,verifyCodeAndSignIn}.js`) and `@convex-dev/rate-limiter` 0.3.2.

N1 was confirmed with a throwaway convex-test file that used the same harness as `accountRecovery.test.ts`. The file was deleted and not committed. All three probe scenarios returned attacker tokens.

The checks match the fix handoff's numbers:

- `bun run --cwd packages/backend test`: 117 files, 1,278 tests passed.
- `bun run --cwd apps/app test`: 24 files, 141 tests passed.
- `bun run typecheck`: 7/7 passed.
- `bun run lint`: passed.

`docs/handoffs/STATUS.md` is absent from the branch. It is not in `origin/main` either, so it does not appear in `origin/main...HEAD`.

## Prior findings

| ID | Finding | Status | Notes |
| --- | --- | --- | --- |
| B1 | Pre-registered attacker password takeover | **Partially resolved** | The original scenario is fixed: the victim's own sign-up hash wins when the victim requests last. The hash is still bound to the *latest request*, not to whoever redeems the code. It is also carried forward across codes, including expired ones. See N1: the takeover still works. |
| B2 | Throttle kills outstanding code and locks out every flow | **Partially resolved** | The limit now runs before code creation in the same transaction, and the outstanding code survives. Each flow has its own token bucket with burst headroom. Single-key lockout remains *per flow*: at about one request every 3 minutes, an attacker keeps a victim's reset, OTP or magic-link requests throttled. Each accepted attacker request emails the victim a working code, so the impact is softer than before. See N3. |
| S1 | Reset / resend timing | Resolved | Both the known and unknown paths reserve quota, schedule `auth:deliverCodeRequest`, and return `{ tokens: null }` before any lookup or send. Sign-up for an existing vs new email still takes different DB paths, as the handoff acknowledges. |
| S2 | Lockout answers faster | Resolved | `TooManyFailedAttempts` now pads (`NeutralPassword.ts:230-236`). |
| S3 | Locale lost | Resolved | `emailRequestParams` forwards `redirectTo`, and the deferred path forwards it too (`auth.ts:152-154`). Tests cover `/fr`. |
| S4 | Missing regression tests | Partially resolved | The B1/B2/S3 and magic/password-link counting tests were added. The form-level parity test is still deferred, and the stated reason is reasonable. The new tests miss N1: every takeover test makes the victim's request last and redeems right away. |
| S5 | Stale `STATUS.md` | Resolved | Removed in `330ff14c`. |
| M1 | Owner's new sign-up password discarded | Resolved | Applied on verification (test `a verified owner can adopt…`). |
| M2 | Limiter rows never cleaned | Resolved (see N4) | Per-key `expireBucket` runs after 30 minutes. Its idle check compares the component's timestamp with the caller's clock, which may make cleanup a no-op in production for mutation-path requests. |
| M3 | Sender wrapper fails open | Resolved | `withCodeRequestLimit` is removed. Enforcement lives in `auth:store` and the public reservation, and no longer depends on a sender `ctx`. |

## N1. Blocker: the pending password follows the latest request, persists past expiry, and is carried into unrelated codes, so account takeover is still possible

- **Where:**
  - `packages/backend/convex/passwordRecovery/verification.ts:39-43`: `passwordHash ?? (preservePassword ? previous?.pendingPasswordHash : undefined)`.
  - `passwordRecovery/NeutralPassword.ts:128` and `:173`: `sendVerification` defaults to `preservePassword = true`.
  - The carry-over is reached from sign-in of an unverified account (`:241-246`) and from verification resend (`:306-310`).
  - Applied at `convex/auth.ts:241-253`.
- **How it works:**
  - Convex Auth deletes an expired code row only when that code is redeemed. `createCode` therefore reads `previous` even when it has long expired, and copies its `pendingPasswordHash` onto the new code.
  - A sign-up for an existing account overwrites the pending hash with the requester's hash. The emails look identical, so the mailbox owner cannot tell which request a code came from.
- **Scenario A (no race, unverified account):** confirmed.
  1. `victim@x` has an unverified `password-with-reset` account. This could be a legacy account, or someone who signed up and never verified.
  2. The attacker sends `flow: "signUp"` for `victim@x` with password `P_a`. The response is neutral. A code carrying `hash(P_a)` is emailed to the victim, who ignores it.
  3. Two days later the code has expired. The victim signs in with their real password. The account is unverified, so `sendVerification` runs with no hash and carries `hash(P_a)` from the expired row onto the new code.
  4. The victim enters the code. `auth:store` sets `secret = hash(P_a)` and invalidates other sessions.
  5. The attacker signs in with `P_a` and gets tokens.
- **Scenario B (race during a fresh sign-up):** confirmed.
  1. The victim signs up and gets code C1, which carries the victim's hash.
  2. The attacker signs up for the same email. The new code C2 carries the attacker's hash, and C1 is deleted.
  3. C1 now fails, so the victim uses the newest email (C2), or presses "resend", which carries the attacker's hash forward.
  4. The attacker's password becomes the account secret.
- **Verified accounts:** affected only through the race, when the victim is in their own sign-up/verification flow (the M1 path).
- **Regression:** on `origin/main`, step 2 of either scenario failed with "already exists".
- **Suggested fix:** bind the password to whoever redeems the code, not to whoever requested it.
  - Preferred: require the password again on the `email-verification` step for existing-account sign-ups. The sign-up form still holds it. Apply it with `modifyAccountCredentials` only after the code verifies, and drop `pendingPasswordHash` for those codes. New-account sign-ups keep the secret the creator set, which the redeemer then confirms.
  - Minimum if the stored hash is kept:
    - Never carry a hash from an expired `previous` row.
    - Never carry a hash into a code triggered by sign-in. A correct current password proves ownership of that secret, so clear the pending hash (`preservePassword = false`).
    - Treat a second sign-up for an account that already has a pending hash as conflicting: clear both hashes and require a fresh sign-up. Without this, the latest requester still wins.
- **Tests to add:**
  - Scenario A, including the expiry.
  - Scenario B with both "redeem latest code" and "resend then redeem".
  - Each test asserts that the attacker's sign-in fails.

## N2. Should-fix: the `auth:store` pending-hash step fails open if Convex Auth changes how codes are looked up

- **Where:** `convex/auth.ts:209-224` and `:231-262`.
- **Scenario:**
  - The wrapper finds the code row itself, by `sha256` hex of `params.code` with `.unique()`, before calling the library handler.
  - Suppose a Convex Auth upgrade salts or namespaces code hashes, or changes the stored format. The library then still redeems the code, but the wrapper's lookup returns `null`.
  - The pending hash is silently skipped and the account keeps its current secret. In the B1 pre-registration case, that secret is the attacker's.
  - The legacy reset guard (`:254-261`) is skipped the same way.
  - The `_handler` existence checks fail closed, but this branch does not. The upgrade suites would catch it only if they are run, which the handoff asks for but nothing enforces.
  - Calling `_handler` directly also bypasses the library's `storeArgs` validator. That is why the extra `codeRequestReserved` field gets through. A library that validates inside its handler would break every code request. That failure would be loud, so it is acceptable.
- **Suggested fix:** when `type === "verifyCodeAndSignIn"`, the result is a successful `{ userId }`, and no code row was found beforehand, throw so the transaction rolls back. Also add a comment naming the library version whose `sha256` hex format this wrapper relies on.

## N3. Should-fix: a sustained single-key lockout per flow remains (residual B2)

- **Where:** `passwordRecovery/codeRequestLimit.ts:18-25` and `:45-52`.
- **Scenario:**
  - Each bucket holds 10 requests and refills one token every 3 minutes, keyed by `flow:email`.
  - An unauthenticated attacker who sends one reset request for `victim@x` every 3 minutes keeps that bucket at zero.
  - The victim's own request always returns `TooManyCodeRequests`, and the UI does not move on to the code-entry step.
  - The same works for `otp` and `magic-link`, which locks out OTP-only and magic-link-only users. Each bucket costs about 20 requests per hour.
  - Each attacker request does email the victim a valid code. The victim could recover only if the UI let them enter a code after a throttle response.
  - `origin/main` had no such lockout.
- **Suggested fix:** on `TooManyCodeRequests` for reset, OTP and verification, let the UI go to the code-entry step ("use the most recent code we sent"). The latest emailed code is valid by construction. Separately, consider a second key the attacker cannot set, from an HTTP-action client signal, to be documented as a rollout limit if it is not adopted.

## N4. Minor: bucket expiry compares the component's clock with the caller's clock

- **Where:** `passwordRecovery/codeRequestLimit.ts:53-60` and `:69`.
- **Scenario:**
  - `requestedAt` is the caller's `Date.now()`, but `state.ts` is the rate-limiter component's own `Date.now()` from its nested mutation.
  - For requests charged inside `auth:store`, the caller is a mutation. If the deployment fixes `Date.now()` at the start of the parent mutation, the component's timestamp is later, `state.ts <= requestedAt` is never true, and the row is never deleted.
  - That would leave M2 unresolved in production for OTP, magic-link, sign-up and sign-in-triggered codes.
  - convex-test uses a live clock, so the test does not show this.
  - Security is not affected either way: an idle bucket is full after 30 minutes.
- **Suggested fix:** decide idleness from the component's own timestamp only. Delete when `Date.now() - state.ts >= refillTime`, which needs no `requestedAt`.

## N5. Minor: `resend` is now a public top-level sign-in provider that shares the `password-link` bucket

- **Where:** `convex/auth.ts:90` and `codeRequestLimit.ts:41`.
- **Scenario:**
  - Registering `verifyProvider` makes code-only password-link callbacks work.
  - It also lets clients call `signIn({ provider: "resend", params: { email } })` as a second magic-link method. That creates `resend` accounts and users, the same as `magic-link`.
  - These requests are charged to `password-link:<email>`, so they drain the victim's password-link verification bucket too.
  - No new capability is exposed beyond `magic-link`. It is an unintended extra public surface.
- **Suggested fix:** keep `resend` registered for callbacks, but reject direct `provider: "resend"` requests without `params.code` in the public `signIn` wrapper. Alternatively, document it as intentional.

## Other areas checked (no finding)

- **`auth:deliverCodeRequest`:** this is an `internalAction`, so clients cannot call it. The reservation is a module-private `Symbol`. It cannot be serialized, so it cannot arrive in client params or `auth:store` args. Convex Auth spreads the context when it enriches it, so the symbol reaches `authorize`. If a library change dropped it, the worker would charge twice; that fails closed and requests are not left uncharged. The public action always charges before it schedules.
- **Charging coverage:** every `createVerificationCode` that reaches `auth:store` charges unless `createCode` marks it reserved. Only the deferred worker sets that mark. Direct `resend-otp`, `magic-link` and `resend` requests are charged as `otp` / `magic-link` / `password-link`.
- **Wrong account:** the pending hash is patched onto `code.accountId`, and only when the redeemed result's `userId` matches that account's user. The hash is a Scrypt hash, is never returned, and never appears in mail arguments.
- **Narrowed legacy guard:** the guard now applies only to `resend-otp-password-reset` codes on unverified password accounts. `completeReset` then installs the new password with `modifyAccountCredentials`. Code-only reset redemption fails, because the extra provider is unavailable without `allowExtraProviders`. Legacy verification keeps its secret, and the test passes.
- **Bucket cleanup race:** `limit` and `expireBucket` are both transactional on the same row. A later accepted request schedules its own cleanup, and a bucket that has been idle for 30 minutes is full, so a reset cannot grant extra quota. N4 is the only gap.
- **Real-user flows:** password sign-in and sign-up, verification, reset, OTP, magic link and code-only password-link pass the suites. Google is untouched. A known-account mail failure is now invisible to the user, which is an accepted trade-off for S1.

## Verdict

**Changes requested.** 7 of 10 prior findings are fully resolved: S1, S2, S3, S5, M1, M2 and M3. B1, B2 and S4 are partially resolved. There is 1 new blocker: N1, a takeover through a pending password hash that is carried over and survives expiry, confirmed by test. There are 2 new should-fix findings (N2 and N3) and 2 new minor ones (N4 and N5). N1 must be fixed, with the scenario A and B regression tests, before this lands.
