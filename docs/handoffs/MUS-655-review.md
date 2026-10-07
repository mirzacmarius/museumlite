# MUS-655 review

Branch `codex/mus-655-recovery` at `6e663fa0`, reviewed against `git diff origin/main...HEAD` (24 files). Inputs: `MUS-655-handoff.md`, `MUS-655-impl.md`, ticket draft 45 / recommendation R32, Convex Auth 0.0.95 internals (`node_modules/@convex-dev/auth/dist/server/implementation`).

The lookup removal, uniform `InvalidCredentials` / `InvalidCode` responses, `{ tokens: null }` reset/verification responses and the UI copy changes are sound. The two blockers below were confirmed with a throwaway convex-test file (run, then deleted, not committed).

## B1. Blocker: sign-up lets a pre-registered attacker password take over the account

- **Where:** `packages/backend/convex/passwordRecovery/NeutralPassword.ts:122-127` (and the race path `:138-142`).
- **Scenario:**
  1. The attacker signs up on `password-with-reset` as `victim@x` with their own password. This creates an unverified account holding the attacker's secret. Because of `shouldLinkViaEmail: true` (`:135`), the account is linked to the victim's existing user if the victim already has a verified email (Google, OTP or magic link).
  2. Later the victim signs up with their own password. `signUp` finds the existing account, hashes and discards the victim's password, and emails the victim a verification code.
  3. The victim enters the code on the screen in front of them. `verifyCodeAndSignIn` marks the account `emailVerified` and signs the victim in. The stored password is still the attacker's.
  4. The attacker signs in with their own password and gets tokens for the victim's user.
  Confirmed in a test: the attacker's `flow: "signIn"` returned tokens. On `origin/main`, step 2 failed with `Account … already exists`, so the victim never verified the attacker's secret. This branch introduces the takeover, and the ticket explicitly forbids takeover regressions.
- **Suggested fix:** whoever completes verification must own the password. Options:
  - For an existing **unverified** account, bind the submitted password to the code. Store a pending hash with the verification request, or require `password` again on the `email-verification` step and set it with `modifyAccountCredentials` after the code verifies. Do not overwrite on request, because a later attacker sign-up would then win the race.
  - Alternatively, answer sign-up for any existing account by sending a **reset** code and set the password in `reset-verification`.
  Either way, add a test: attacker pre-registers, victim signs up and verifies, attacker sign-in fails, victim's password works.

## B2. Blocker: anyone can lock any email out of every code flow and kill the owner's outstanding code

- **Where:** `packages/backend/convex/passwordRecovery/codeRequestLimit.ts:49-55`, used at `otp/ResendOTP.ts:19`, `passwordReset/ResendOTPPasswordReset.ts:18`, `auth.ts:25`, `auth.ts:33`. Reached from `NeutralPassword.ts:113`, `NeutralPassword.ts:180`.
- **Scenario:** the limit runs inside `sendVerificationRequest`. Convex Auth calls that only after `createVerificationCode` has committed, and that call deletes the account's existing code and inserts a new one (`generateUniqueVerificationCode`).
  - Request 6 in the window therefore replaces the owner's emailed code with one that is never sent, then throws `TooManyCodeRequests`. Confirmed in a test: after five resets plus a sixth throttled one, the owner's latest emailed code returns `InvalidCode`.
  - The bucket is keyed only by email and shared across reset, verification, `resend-otp` and `magic-link`. An unauthenticated attacker sending 5 requests every 15 minutes for `victim@x` keeps the victim permanently unable to reset a password, verify, or sign in by OTP or magic link. OTP-only and magic-link-only users are fully locked out.
  - Before this branch, each request at least delivered a fresh working code. This is the denial regression the acceptance criteria rule out.
- **Suggested fix:**
  - Check the limit before any code is created. In `NeutralPassword`, do it before `signInViaProvider`. For `resend-otp` and `magic-link`, front the request with a path that checks the limit before calling `signInViaProvider`, because the Email provider's `sendVerificationRequest` runs too late.
  - When the limit is hit, leave the outstanding code intact.
  - Reduce single-key lockout: use a token bucket with burst headroom, and keep per-flow buckets or add a second key the attacker does not control (for example a client/IP signal from an HTTP action) so one actor cannot zero a victim's bucket.
  - Add a test that the owner's code still works after the attacker is throttled.

## S1. Should-fix: reset and verification-resend timing still reveal account existence

- **Where:** `NeutralPassword.ts:175-183` (reset) and `:211-217` (verification resend).
- **Scenario:** for an existing password account the action runs `createVerificationCode` (mutation), the limiter mutation and a synchronous `fetch` to Resend before returning. For an unknown email it runs only the limiter. The difference is roughly one Resend round-trip (typically 100 ms or more). An attacker can measure it from the public `auth:signIn` action with a few requests per email, inside the 5-per-window budget. The impl doc calls this a rollout limit. The ticket asks for timing-safe behaviour "where practical", and this case is practical to fix.
- **Suggested fix:** make both paths do the same work before responding. Hand the Resend send to `ctx.scheduler.runAfter(0, internal…)` so no path waits on the network, or schedule an equivalent no-op for the unknown path. Also do the code-creation mutation in both paths, or neither.

## S2. Should-fix: locked-out accounts answer faster than unknown emails

- **Where:** `NeutralPassword.ts:158-162`.
- **Scenario:** only `InvalidAccountId` runs `padUnknownPassword`.
  - After 10 wrong passwords, `retrieveAccountWithCredentials` returns `TooManyFailedAttempts` without any Scrypt work, so request 11 is fast.
  - An unknown email never accrues a lockout and keeps paying the Scrypt pad.
  - So an attacker sends 11 guesses: a fast 11th response means the account exists. As a side effect the real owner is locked out for the hour.
- **Suggested fix:** pad on `TooManyFailedAttempts` as well. Consider recording failed attempts for unknown identifiers too, so both cases follow the same lockout curve.

## S3. Should-fix: reset, resend and existing-account sign-up emails lose the user's locale

- **Where:** `NeutralPassword.ts:126`, `:141`, `:182`, `:217`.
- **Scenario:** these calls pass `params: { email }` and drop `redirectTo` (`/${locale}`, sent by `form-root.tsx:106,123` and `password.tsx:109`). `getEmailLocaleFromAuthUrl` therefore falls back to `en`.
  - A French, Spanish, Norwegian or Romanian user who requests a password reset or a verification resend now gets an English email. On `origin/main`, `Password` forwarded the full `params`.
  - On `password-link`, the verification link loses the locale path.
  - New sign-ups (`:144`) still forward params, so the locale behaviour is inconsistent between flows.
- **Suggested fix:** forward only `redirectTo` along with the normalized email, for example `{ email, redirectTo: params.redirectTo }`, in all four calls. Add a test that a `/fr` reset request produces French copy.

## S4. Should-fix: tests miss the acceptance cases that failed above

- **Where:** `packages/backend/tests/accountRecovery.test.ts:254-301`, `:325-368`, and `apps/app/src/auth/recovery-messages.test.ts`.
- **Scenario:**
  - The sign-up takeover test only covers a **verified** owner, so B1 passes.
  - The throttle test checks only the error code and never checks that the owner's code survives, so B2 passes.
  - No test sends a localized reset (S3).
  - No test counts `magic-link` or `password-link` sends.
  - The UI parity criterion ("compare existing/nonexistent … at public boundary and UI") is covered only by the pure key-mapping helpers. `form-root.tsx` and `password.tsx` (step transitions, toasts for `InvalidCredentials`, `TooManyCodeRequests`, reset for an unknown email) have no component test.
- **Suggested fix:** add the regression tests named in B1–S3. Add a form-level test that the same email-step → password-step → reset sequence renders identically for a known and an unknown email.

## S5. Should-fix (do not land): stale `docs/handoffs/STATUS.md`

- **Where:** `docs/handoffs/STATUS.md` (whole file). It came from stale commit `ffdc258e` via the `codex/mus-610-integration` merge.
- **Scenario:** if this lands on `main`, main carries an inaccurate MUS-610 pipeline tracker. It lists MUS-655 as "implement (finish) / Grok 4.7", has stale stage and provider assignments, includes per-thread links, and says tickets are merged "in `codex/mus-610-integration`". None of this belongs to MUS-655.
- **Suggested fix:** drop the file from this branch before landing, either by reverting it on the branch or by excluding it when squashing. Flagged only, not changed here.

## M1. Minor: an existing owner's new sign-up password is silently discarded

- **Where:** `NeutralPassword.ts:124-127`.
- **Scenario:** a verified user forgets they have an account and signs up with a new password. They receive a code, enter it, and are signed in, so it looks like the new password was set. On their next visit the new password fails with `InvalidCredentials`. The B1 fix (bind the submitted password on verification) also fixes this.

## M2. Minor: per-email limiter rows are never cleaned up

- **Where:** `codeRequestLimit.ts:30-32`.
- **Scenario:** each distinct normalized email submitted to reset or verification-resend writes a `rateLimits` row in the component, whether or not an account exists. Nothing calls `clearAll` or `resetRateLimit`, so an unauthenticated caller cycling random addresses grows the table without bound. Windows do expire logically, so there is no permanent lockout.
- **Suggested fix:** add a cron that calls the component's `clearAll({ before: now - window })`.

## M3. Minor: the send wrapper fails open when no context is passed

- **Where:** `codeRequestLimit.ts:52-54`.
- **Scenario:** Convex Auth passes `ctx` to `sendVerificationRequest` behind a `@ts-expect-error`. If an upgrade stops passing it, sends for existing accounts stop being counted, while unknown emails still hit `enforceCodeRequestLimit` directly (`NeutralPassword.ts:177`, `:214`). Request 6 would then succeed for an existing account and return `TooManyCodeRequests` for an unknown one, which reveals existence again. The only reason for the fail-open branch is that direct sender tests call the function without a context.
- **Suggested fix:** throw when `ctx` is missing, and have the sender tests call the unwrapped sender (export it separately) or pass a stub context.

## Verdict

**Changes requested.** 2 blockers (B1 sign-up pre-hijack takeover, B2 throttle-driven code invalidation and lockout), 5 should-fix (S1–S5, including removing `STATUS.md`), 3 minor. The existence-disclosure work on responses and UI copy is largely correct. B1 and B2 must be fixed with regression tests before this lands.
