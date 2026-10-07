# MUS-655 implement handoff

Branch: `codex/mus-655-recovery`. Base for landing: `origin/main` at `7199d434` (MUS-610 Batch 2, PR #147). The stale `codex/mus-610-integration` tip was merged earlier and then replaced by this main merge. Not pushed. No Linear or production changes.

## Files changed

- Removed `packages/backend/convex/authLookup.ts` and its generated API entry.
- Added `packages/backend/convex/passwordRecovery/` (`NeutralPassword`, shared error codes, per-email code-request limit).
- `packages/backend/convex/auth.ts` uses `NeutralPassword` for every password provider. Magic-link and password-link mail still go through `sendLocalizedMagicLinkEmail`, wrapped with the same limit.
- `packages/backend/convex/otp/ResendOTP.ts` and `passwordReset/ResendOTPPasswordReset.ts` keep localized code mail and count each send.
- Login UI: `apps/app/src/auth/form-root.tsx`, `password.tsx`, `email.tsx`, `recovery-messages.ts`. Locales `en`, `fr`, `es`, `no`, `ro`.
- Tests: `packages/backend/tests/accountRecovery.test.ts`, `auth-upgrade.test.ts`, `testHarness.ts`, `apps/app/src/auth/recovery-messages.test.ts`.

## Behaviour

Public password sign-in returns `{ code: "InvalidCredentials" }` for a wrong password, an unknown email, and a locked-out account. An unknown email runs a Scrypt verify against a fixed pad so that path is not an immediate rejection. Sign-up on `password-with-reset` always returns `{ tokens: null }` and emails a verification code when a password account exists; the submitted password is hashed and discarded, so it cannot replace the owner's password. Providers without email verification (`password`) answer `SignUpUnavailable` for every email and still accept sign-in.

Reset and verification resends return `{ tokens: null }` for an existing password account, an unknown email, and an email that only has a code login. Mail is sent only when a matching password account exists. A bad code is `InvalidCode` in every case. Code requests (password reset, verification, OTP, magic link) share a limit of 5 per normalized email per 15 minutes, whether or not an account exists. The sixth request is `TooManyCodeRequests`.

The login page no longer calls `hasPasswordAccountForEmail`. Entering an email stays on the mode the person chose (sign in or create account). Help text, failures, and reset all use the same copy for known and unknown emails. MUS-666 stays: login heading and description, the full-width Create account button, and Google below the form with "Or continue with Google".

## Red/green evidence

- `accountRecovery.test.ts` was written against the old lookup and password provider, then passed once `NeutralPassword` replaced it (8 tests: lookup removed, identical credential failures, lockout, reset, sign-up takeover, verification, throttle, unverified provider).
- `auth-upgrade.test.ts` first failed with `SignUpUnavailable` on the bare `password` provider, then failed because verification stored the un-normalized address. It is green on `password-with-reset`: trimmed lowercase email, verification, wrong password rejected, original password accepted.
- `convex/email/senders.test.ts` failed because the rate-limit wrapper required an action context. Direct sender tests call the mail function without one; Convex Auth still passes the context, and those calls are what the throttle test counts.
- Backend typecheck failed on `GenericDoc` from `retrieveAccount` / `createAccount` until those calls were parameterized with `DataModel`.

## Check results

After merging `origin/main` and applying `scripts/apply-patches.js` (convex-test search patch from main; `node_modules` only):

- `bun run --cwd packages/backend test`: 117 files, 1261 tests passed.
- `bun run --cwd apps/app test`: 24 files, 141 tests passed.
- `bun run typecheck`: 7 packages passed.
- `bun run typecheck:i18n`: passed.
- `bun run lint`: passed, sherif reported no issues.

## Rollout limits

No schema change. Deploy must regenerate Convex bindings so `authLookup` disappears and `passwordRecovery` is included; do not run codegen from this worktree. Email still uses the existing Resend senders. Tests stub `fetch` and do not send real mail.

Unknown-email reset and verification resends skip the network send, so they can return faster than a real send. Password-guess lockout is reported as `InvalidCredentials`, not as a distinct lockout. The bare `password` provider no longer creates accounts.

## Open questions

None for this ticket. A follow-up could pad unknown-email code requests to the cost of a mail send if that timing difference is treated as a disclosure.
