# Local full-stack QA

An isolated Convex backend on loopback for exercising the real app without touching a cloud deployment. State lives in the gitignored `.local-qa/` folder of this checkout, so each worktree has its own.

```bash
bun run qa:backend                     # start backend on 127.0.0.1:3230 (QA_PORT to change)
bun run convex:local -- deploy --yes   # push packages/backend/convex to it
bun run qa:seed                        # auth keys, synthetic QA user and organization
bun run qa:app                         # Next.js app on :3000 pointed at it (QA_APP_PORT to change)
bun run qa:app -- --build              # production build (apps/app/.next/local-qa), then next start
bun run qa:session                     # how to get a signed-in browser session
EXPOSE_TESTING_API=1 bun run qa:app -- --build   # production build with the instant() testing API
bun run --cwd apps/app test:e2e        # instant-navigation Playwright tests against that build
bun run codegen:local                  # regenerate packages/backend/convex/_generated
bun run qa:backend -- --stop           # stop the backend
```

Sign in at `/en/login` with the email and password in `.local-qa/credentials.json`; the seeded account is verified and lands on the dashboard. If the login page cannot be driven, `bun run qa:session` writes fresh auth cookies to `.local-qa/storage-state.json` for Playwright (`browser.newContext({ storageState })`) or manual use. If the app runs on another port, set `QA_APP_PORT` for `qa:seed` and `qa:session` too.

CI runs the same backend, deploy and seed as uncached steps in the `Check / check` job of `.github/workflows/check.yml` for backend and shared changes, with the Linux backend binary pinned there.

## Notification email

The QA backend has no email provider, so Notification settings (`/notifications/settings`) reports email as unavailable. To exercise instant email without sending anything, run the loopback fixture and point the backend at it:

```bash
bun run qa:email-fixture                    # 127.0.0.1:3745 (EMAIL_FIXTURE_PORT to change)
bun run convex:local -- env set NOTIFICATION_EMAIL_FIXTURE_URL=http://127.0.0.1:3745/emails
curl -X POST http://127.0.0.1:3745/mode -d refuse   # accept | refuse | unavailable
```

The fixture answers like the provider (200 with an id, 422 refused, 503 unavailable) and logs each request, with its plain text, to `.local-qa/email-fixture.jsonl`. Only loopback URLs are accepted; any other value turns email off.

Daily and weekly digests go out at the digest time chosen in Notification settings, in the browser's time zone, so pick a time a minute or two ahead to watch one arrive. The five-minute `sweep-notification-emails` cron also sends a digest whose time passed while the backend was stopped.

## Rules

- Run every Convex CLI command through `bun run convex:local -- <args>`. It strips cloud variables and refuses to run unless the recorded target is loopback. A bare `convex` command uses `packages/backend/.env.local`, which points at the cloud.
- The backend binary comes from `convex dev --local`'s download cache (`~/.cache/convex/binaries`); set `CONVEX_LOCAL_BACKEND_BIN` to use another.
- Stop any older app server on the same port before `qa:app`; a stale server causes a `/login` redirect loop.
- Node actions (for example Sharp thumbnail generation) did not load in the local backend's Node executor during MUS-610 QA, so verify them through the automated tests or on a cloud dev deployment with the user's authorization.
- Keep progress and handoff notes for a run in `.local-qa/`, not `/tmp`.
