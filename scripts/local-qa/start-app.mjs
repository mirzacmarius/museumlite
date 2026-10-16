#!/usr/bin/env node
/**
 *   bun run qa:app             dev server on port 3000
 *   QA_APP_PORT=3100 bun run qa:app
 *   bun run qa:app -- --build  production build, then `next start`
 */
import { createServer } from "node:net";
import { join } from "node:path";
import { localOnlyEnv, readState, root, run } from "./lib.mjs";

const { state } = readState();
const port = process.env.QA_APP_PORT ?? "3000";
const production = process.argv.includes("--build");
const options = {
  cwd: join(root, "apps/app"),
  env: localOnlyEnv({
    NEXT_PUBLIC_CONVEX_URL: state.url,
    NEXT_PUBLIC_CONVEX_SITE_URL: state.site,
    SKIP_ENV_VALIDATION: "1",
    ...(production ? { LOCAL_QA: "1", SENTRY_AUTH_TOKEN: "" } : {}),
  }),
};

const portTaken = await new Promise((resolve) => {
  const probe = createServer();
  probe.once("error", () => resolve(true));
  probe.listen(Number(port), "127.0.0.1", () =>
    probe.close(() => resolve(false)),
  );
});
if (portTaken) {
  console.error(
    `✗ Port ${port} is already in use. Stop that server first, or set QA_APP_PORT.`,
  );
  process.exit(1);
}

if (production) {
  const built = run("bunx", ["next", "build"], options);
  if (built !== 0) process.exit(built);
  process.exit(run("bunx", ["next", "start", "-p", port], options));
}

process.exit(run("bunx", ["next", "dev", "-p", port], options));
