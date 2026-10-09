# Local full-stack QA

An isolated Convex backend on loopback for exercising the real app without touching a cloud deployment. State lives in the gitignored `.local-qa/` folder of this checkout, so each worktree has its own.

```bash
bun run qa:backend                     # start backend on 127.0.0.1:3230 (QA_PORT to change)
bun run convex:local -- deploy --yes   # push packages/backend/convex to it
bun run qa:seed                        # auth keys, synthetic QA user and organization
bun run qa:app                         # Next.js app on :3000 pointed at it (QA_APP_PORT to change)
bun run qa:session                     # how to get a signed-in browser session
bun run codegen:local                  # regenerate packages/backend/convex/_generated
bun run qa:backend -- --stop           # stop the backend
```

Sign in at `/en/login` with the email and password in `.local-qa/credentials.json`; the seeded account is verified and lands on the dashboard. If the login page cannot be driven, `bun run qa:session` writes fresh auth cookies to `.local-qa/storage-state.json` for Playwright (`browser.newContext({ storageState })`) or manual use. If the app runs on another port, set `QA_APP_PORT` for `qa:seed` and `qa:session` too.

CI runs the same backend, deploy and seed in the `deploy` job of `.github/workflows/check.yml`, with the Linux backend binary pinned there.

## Rules

- Run every Convex CLI command through `bun run convex:local -- <args>`. It strips cloud variables and refuses to run unless the recorded target is loopback. A bare `convex` command uses `packages/backend/.env.local`, which points at the cloud.
- The backend binary comes from `convex dev --local`'s download cache (`~/.cache/convex/binaries`); set `CONVEX_LOCAL_BACKEND_BIN` to use another.
- Stop any older app server on the same port before `qa:app`; a stale server causes a `/login` redirect loop.
- Node actions (for example Sharp thumbnail generation) did not load in the local backend's Node executor during MUS-610 QA, so verify them through the automated tests or on a cloud dev deployment with the user's authorization.
- Keep progress and handoff notes for a run in `.local-qa/`, not `/tmp`.
