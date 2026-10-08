# Local full-stack QA

An isolated Convex backend on loopback for exercising the real app without touching a cloud deployment. State lives in the gitignored `.local-qa/` folder of this checkout, so each worktree has its own.

```bash
bun run qa:backend                     # start backend on 127.0.0.1:3230 (QA_PORT to change)
bun run convex:local -- deploy --yes   # push packages/backend/convex to it
bun run qa:seed                        # auth keys, synthetic QA user and organization
bun run qa:app                         # Next.js app on :3000 pointed at it (QA_APP_PORT to change)
bun run qa:backend -- --stop           # stop the backend
```

Sign in with the email and password in `.local-qa/credentials.json`.

## Rules

- Run every Convex CLI command through `bun run convex:local -- <args>`. It strips cloud variables and refuses to run unless the recorded target is loopback. A bare `convex` command uses `packages/backend/.env.local`, which points at the cloud.
- The backend binary comes from `convex dev --local`'s download cache (`~/.cache/convex/binaries`); set `CONVEX_LOCAL_BACKEND_BIN` to use another.
- Stop any older app server on the same port before `qa:app`; a stale server causes a `/login` redirect loop.
- Node actions (for example Sharp thumbnail generation) did not load in the local backend's Node executor during MUS-610 QA, so verify them through the automated tests or on a cloud dev deployment with the user's authorization.
- Keep progress and handoff notes for a run in `.local-qa/`, not `/tmp`.
