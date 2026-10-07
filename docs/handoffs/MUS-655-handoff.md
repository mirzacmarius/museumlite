# MUS-655 handoff: finish implement stage

Ticket: `docs/audits/2026-10-04/ticket-drafts/45-recover-accounts-without-existence-disclosure.md` (and its recommendation in `docs/audits/2026-10-04/recommendations.md`)
Branch: `codex/mus-655-recovery`

## State

A previous implementer stopped at a usage limit with uncommitted work in this worktree: red tests (`packages/backend/tests/accountRecovery.test.ts`, `testHarness.ts`, `auth-upgrade.test.ts`) and partial changes to `convex/auth.ts`, `convex/otp/ResendOTP.ts`, `convex/passwordReset/ResendOTPPasswordReset.ts`, a deleted `convex/authLookup.ts` and a new `convex/passwordRecovery/`. Review it; keep what is sound.

The integration tip now contains `9793ebab` "fix(auth): clarify login and account creation (MUS-666)", which changes the same login flow. First commit the existing work as a checkpoint, then merge `codex/mus-610-integration` and resolve conflicts preserving MUS-666 behaviour, before building further.

## Task

- Remove account-existence disclosure (for example the login page's "We found an existing account for <email>") across sign-in, sign-up, password reset and unique-code flows, with uniform responses and timing-safe behaviour where practical.
- Keep real sign-in, sign-up, password reset and OTP flows working. Never log or return secrets. Email stays on the existing provider abstraction; tests must not send real email.
- Merge the integration tip, run all checks, write `docs/handoffs/MUS-655-impl.md`.

## Rules (all stages)

- Work only in this worktree and branch. Do not push. No Linear or production changes.
- Never run `convex dev`, `convex deploy`, `convex codegen`, `convex run` or `bun dev`: they target the cloud deployment. Tests use convex-test only.
- Test first (red, then green): see `~/.agents/skills/tdd/SKILL.md`. Test through public Convex APIs (`api.*` via `authedForUser`), HTTP routes or pure lib functions; `t.run` only for fixture setup.
- Institutional records are permanent: additive schema only, legacy data keeps working. No TODOs, placeholder controls, or UI without a working backend.
- UI copy: add keys to `apps/app/src/locales/en.ts` and to every other locale (`fr es no ro`) that already has the parent block.
- Run Biome only on files you changed (`bunx biome check --write <files>`).
- Done means all pass after merging the current `codex/mus-610-integration` tip into this branch: `bun run --cwd packages/backend test`, `bun run --cwd apps/app test`, `bun run typecheck`, `bun run typecheck:i18n`, `bun run lint`.
- Commit as you go (one commit per green slice). No attribution lines in commit messages.
- If the provider reports a usage or rate limit, stop immediately and do not retry.
- Finish by writing `docs/handoffs/<TICKET>-impl.md` (files changed, behaviour, red/green evidence, check results, rollout limits, open questions), commit it, and end with a final message of at most five lines.

Repo rules: `AGENTS.md`, `packages/backend/convex/AGENTS.md`, `convex/_generated/ai/guidelines.md`, `GLOSSARY.md`, `docs/adr/`.
