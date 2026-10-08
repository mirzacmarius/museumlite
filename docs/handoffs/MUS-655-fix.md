# MUS-655 fix handoff

Branch: `codex/mus-655-recovery`. Reviewed input: `c3ac1185`. Final implementation: `3c8662d0`. All work stayed in this worktree with one agent. No push, Linear changes, deployment, Convex cloud commands, or deployment codegen.

## Findings and fixes

All test names below are in `packages/backend/tests/accountRecovery.test.ts` unless another file is named.

### B1 and M1: password ownership after verification

Sign-up stores the submitted password hash on its verification-code row. `passwordRecovery/verification.ts:createCode` creates the code and attaches the hash in the same mutation transaction. A new request never overwrites an existing account's active password. Verification resends carry the pending hash onto the replacement code; reset requests discard it.

The `auth:store` adapter reads the code before Convex Auth consumes it. Only successful redemption applies the hash to that code's account, within the same transaction, and invalidates other sessions. This also covers direct OTP redemption and code-only password-link callbacks. The password-link email provider is registered for those callbacks. Invalid, stale, expired, or wrong-identifier codes cannot activate a pending password. No plaintext password is stored on the code or included in mail arguments.

Tests:

- `victim verification replaces a pre-registered attacker's password (linked user: %s)`, both a fresh user and a user already verified through OTP.
- `sign-up for a registered email looks like a new sign-up and cannot replace the password before verification`.
- `a verified owner can adopt their new sign-up password only by verifying`.
- `a code-only password-link callback activates the password bound to that link`.
- `a code-only reset cannot activate a pre-registered password`.
- `legacy unverified password accounts retain password sign-in after verification`.

The last test caught an overly broad credential-clearing guard during final review. The guard now applies only when an unverified password account redeems a reset code. Ordinary legacy verification retains its existing credential. A legitimate reset still installs the new password through `modifyAccountCredentials`.

### B2: throttling and outstanding codes

The limiter runs before Convex Auth's code-creation mutation handler. The quota check, replacement of the code, and attachment of its password hash are transactional. A rejected request cannot delete or replace the outstanding code.

Buckets use normalized email plus flow: reset, password verification, OTP, magic link, and password link. Each has capacity ten and refills five tokens per fifteen minutes, or one every three minutes. All password providers use the same bucket for a given recovery flow. There is no client/IP key; the Convex Auth action boundary does not supply a trustworthy client IP.

Deferred reset and verification-resend requests reserve quota before scheduling. A private context symbol tells the internal worker that it owns a reservation; this is not a client parameter. The worker does not charge again.

Tests:

- `the owner's last emailed reset code survives throttled requests`.
- `code requests are throttled per email regardless of account existence`, including independent OTP and verification requests after reset exhaustion.
- `%s counts every request and preserves the final code on throttle`, for `resend-otp`, `magic-link`, and `password-link`. Each delivers ten messages, rejects the next request without sending, accepts the final emailed code, and accepts a request after one token refills.

### S1: reset and resend timing

The public action normalizes the email, reserves quota, and queues `auth:deliverCodeRequest` for both known and unknown identifiers. It returns `{ tokens: null }` before account lookup, code creation, or Resend delivery. Unknown-account workers finish without sending. Mail still uses the existing localized provider senders.

Test: `%s acknowledges existing and unknown requests without waiting for email`, for reset and verification resend. The email response is deliberately held unresolved; both public requests still acknowledge. The timeout in this test is a deadlock guard, not a statistical timing benchmark.

### S2: lockout timing

`TooManyFailedAttempts` now performs the same Scrypt pad as `InvalidAccountId` before returning `InvalidCredentials`.

Test: `locked-out and unknown emails both perform password verification work`. It observes the real Scrypt primitive through a spy while calling the public auth action. The primitive is not replaced, and elapsed-time comparisons are avoided. The existing `a locked-out account fails like an unknown email` test also passes.

### S3: locale preservation

Code-request calls forward normalized email and `redirectTo`, excluding password and unrelated parameters. Existing-account sign-up, the sign-up race path, reset, and verification resend all retain the locale. Code destinations remain on the configured site origin.

Tests:

- `a /fr reset request delivers French password-reset copy`, including the French subject.
- `%s preserves /fr on existing-account sign-up and verification resend`, for password-with-reset and password-link, including the link destination.

### S4: regression coverage

The requested takeover, outstanding-code, French-reset, and magic/password-link counting cases are covered above. Backend tests use public auth actions and stub Resend; `t.run` in the new legacy-account test only creates its fixture. `auth-upgrade.test.ts` now drains deferred reset delivery before reading the emailed code. Existing sender tests and the app's `recovery-messages.test.ts` pass.

The optional interactive form-level parity test was not added. The app's Vitest harness is Node-only and has no installed DOM/component interaction testing dependency. No UI implementation changed in this fix stage; full form interaction remains a manual QA item.

### S5: stale handoff status

Removed `docs/handoffs/STATUS.md` in its own commit, `330ff14c`. Verified the tracked file is absent. No runtime test applies.

### M2: idle limiter rows

Every accepted request schedules per-key cleanup after thirty minutes, the full burst refill time. Cleanup reads the component's last-use timestamp and deletes the bucket only when no later accepted request has used it. A newer request supplies its own eventual cleanup. This touches only the auth bucket being expired.

Test: `expiry of an older request does not reset an active email's quota`, with controlled timers, scheduled cleanup, continued throttling of the active bucket, and successful requests after expiry.

### M3: sender wrapper fails open

Removed `withCodeRequestLimit`. Senders remain pure mail functions; quota enforcement belongs to the internal code-creation mutation and public deferred-request reservation. It no longer depends on Convex Auth passing context to a sender. Structured recovery errors are normalized at the public action boundary so nested mutation calls return the same payload as direct rejection.

Tests: all three `%s counts every request and preserves the final code on throttle` cases; existing `convex/email/senders.test.ts` direct-sender tests.

## Red and green evidence

Before implementation, B1 returned attacker tokens in both pre-registration tests; B2 returned `InvalidCode` for the owner's last emailed code; S2 performed zero Scrypt verifications on the locked-out path; S3 delivered `lang="en"` for `/fr`. S1 also failed with `waited for email` while delivery was blocked. Each regression passed after its fix. The later legacy-account regression failed with `InvalidCredentials` after legitimate verification and passed after narrowing the guard.

## Final checks

Run against the final implementation on 2026-10-08:

| Command | Result |
| --- | --- |
| `bun run --cwd packages/backend test` | 117 files, 1,278 tests passed |
| `bun run --cwd apps/app test` | 24 files, 141 tests passed |
| `bun run typecheck` | Seven workspace tasks passed |
| `bun run typecheck:i18n` | Passed |
| `bun run lint` | Passed; sherif reported no issues |
| `git diff --check` | Passed |

No unresolved check failures remain. Biome writes were limited to changed files. The existing dependency patches were already sufficient; `scripts/apply-patches.js` did not need to run.

## Remaining timing and delivery caveats

These tests establish equal responses, Scrypt work on the lockout path, and removal of synchronous mail work from reset/resend acknowledgements. They do not establish constant wall-clock latency. Database, scheduling, hash initialization, and transport costs can vary. Unknown identifiers still do not acquire Convex Auth's password-guess lockout records. Bad-code verification and new versus existing sign-up retain different database paths.

A sustained actor can exhaust an individual flow's email quota, or attack multiple flow buckets separately. Throttling preserves the outstanding code and leaves separately funded flows available; it does not provide an IP-based abuse barrier. Password-guess and bad-code lockouts still belong to Convex Auth.

A reset/resend acknowledgement confirms queueing, not delivery. Known-account mail failure now occurs in the scheduled action; the client retains its neutral response. Queue latency and overlapping accepted requests can affect when messages arrive and which code is current.

## Rollout notes

The schema change is additive: optional `pendingPasswordHash` on `authVerificationCodes`, preserving the existing fields and indexes. Existing records require no backfill. Generated API module declarations were updated locally by hand; no cloud codegen ran.

The adapters use the installed Convex Auth/Convex registered-function `_handler` shape, check its availability, and preserve the library's command payloads. Auth upgrades must run the upgrade and recovery suites. No real OAuth browser flow, Resend delivery, or production deployment was exercised in this stage.

## Re-review follow-up (N1, N2, N4)

`MUS-655-rereview.md` N1 showed a stored sign-up password still followed the latest requester, so takeover remained possible. The stored-password design was removed rather than patched:

- Sign-up for an existing account never sets a password. It emails the owner a verification code, and the response is unchanged.
- If the account is unverified and the requester does not know its current password, `releaseUnverifiedSecret` clears the password. Neither claimant can sign in, and the mailbox owner sets a password through reset. This is the same outcome as on `origin/main`, where sign-up reported "already exists" and the owner reset.
- Repeating a sign-up with the account's current password keeps that password.
- Verified accounts keep the owner's password. M1 (adopting a new password through sign-up) is withdrawn; owners use reset.
- `pendingPasswordHash` and the `authVerificationCodes` schema override are gone, so there is no schema change. The `auth:store` wrapper no longer looks up codes, which removes N2, and now only charges the quota. The reset-code credential guard went with it; `a code-only reset cannot activate a pre-registered password` still passes.
- N4: bucket expiry compares only the limiter's own timestamp (`Date.now() - state.ts >= refill time`).

New and rewritten tests, all red before and green after: pre-registered attacker (with and without a linked OTP user), attacker sign-up on the owner's unverified account, expired attacker claim then owner sign-in and resend, resend after a competing sign-up, same-password repeat sign-up, verified owner keeps their password, and the code-only password-link callback.

Not addressed: N3 (a sustained per-flow throttle; fixing it means the UI moves to code entry on `TooManyCodeRequests`) and N5 (direct `provider: "resend"` requests). Both are follow-ups.

Checks: backend 117 files and 1,282 tests passed, app 141 tests passed, `typecheck`, `typecheck:i18n`, `lint` and `git diff --check` all passed.
