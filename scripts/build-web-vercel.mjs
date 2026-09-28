import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const webDirectory = resolve(root, "apps/web");
const backendDirectory = resolve(root, "packages/backend");
const targetEnvironment =
  process.env.VERCEL_TARGET_ENV ?? process.env.VERCEL_ENV;

if (!targetEnvironment) {
  throw new Error("The Vercel target environment is required for this build");
}

if (targetEnvironment === "production") {
  // Use the same Convex deployment as the live admin app.
  const liveAdminConvexUrl = "https://limitless-canary-667.convex.cloud";
  const result = spawnSync("npx", ["turbo", "run", "build"], {
    cwd: webDirectory,
    env: {
      ...process.env,
      NEXT_PUBLIC_CONVEX_URL: liveAdminConvexUrl,
    },
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

const result = spawnSync(
  "npx",
  [
    "convex",
    "deploy",
    "--cmd",
    "cd ../../apps/web && turbo run build",
    "--cmd-url-env-var-name",
    "NEXT_PUBLIC_CONVEX_URL",
  ],
  { cwd: backendDirectory, env: process.env, stdio: "inherit" },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
