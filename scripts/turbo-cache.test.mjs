import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

const repository = resolve(import.meta.dirname, "..");
const turbo = resolve(repository, "node_modules/.bin/turbo");
const temporaryDirectories = [];

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function put(directory, path, contents) {
  const target = join(directory, path);
  await mkdir(resolve(target, ".."), { recursive: true });
  await writeFile(target, contents);
}

function git(directory, ...args) {
  execFileSync("git", args, { cwd: directory, stdio: "ignore" });
}

async function putWorkspace(directory, path, scripts = {}) {
  const manifest = JSON.parse(
    await readFile(join(repository, path, "package.json"), "utf8"),
  );
  const dependencies = Object.fromEntries(
    Object.entries(manifest.dependencies ?? {}).filter(([, version]) =>
      version.startsWith("workspace:"),
    ),
  );
  await put(
    directory,
    `${path}/package.json`,
    JSON.stringify({ name: manifest.name, dependencies, scripts }, null, 2),
  );
}

async function makeTurboFixture() {
  const directory = await mkdtemp(join(tmpdir(), "museumlite-turbo-cache-"));
  temporaryDirectories.push(directory);
  await put(directory, ".gitignore", ".turbo\nruns.log\n.env*\n");
  await put(
    directory,
    "package.json",
    JSON.stringify(
      {
        name: "cache-fixture",
        private: true,
        packageManager: "bun@1.3.14",
        workspaces: ["apps/*", "packages/*", "tooling/*"],
      },
      null,
      2,
    ),
  );
  await put(
    directory,
    "turbo.json",
    await readFile(join(repository, "turbo.json"), "utf8"),
  );
  await put(
    directory,
    "scripts/load-monorepo-env.mjs",
    "// initial command input\n",
  );
  await put(
    directory,
    "scripts/verify-deploy.mjs",
    "// initial deploy check\n",
  );
  await put(directory, ".github/workflows/check.yml", "name: Check\n");
  await put(directory, "patches/runtime.patch", "initial patch\n");
  await put(directory, "biome.json", '{"$schema":"fixture"}\n');
  await put(directory, "tsconfig.json", '{"compilerOptions":{}}\n');
  await put(
    directory,
    "tooling/typescript/base.json",
    '{"compilerOptions":{"strict":true}}\n',
  );
  await putWorkspace(directory, "packages/backend");
  await put(
    directory,
    "packages/backend/convex/utils/featurePolicy.ts",
    "export const policy = 'standard';\n",
  );
  for (const name of ["analytics", "logger", "ui"]) {
    await putWorkspace(directory, `packages/${name}`);
    await put(
      directory,
      `packages/${name}/src/index.ts`,
      `export const ${name} = true;\n`,
    );
  }
  await putWorkspace(directory, "apps/web", {
    build: "node build-runner.mjs",
    test: "node test-runner.mjs",
  });
  await put(
    directory,
    "apps/web/build-runner.mjs",
    [
      "import { appendFileSync } from 'node:fs';",
      "import { resolve } from 'node:path';",
      "appendFileSync(resolve(import.meta.dirname, '../../build-runs.log'), [process.env.CI, process.env.SKIP_ENV_VALIDATION, process.env.NEXT_PUBLIC_CONVEX_URL].join(':') + String.fromCharCode(10));",
    ].join("\n"),
  );
  await put(
    directory,
    "apps/web/test-runner.mjs",
    [
      "import { appendFileSync } from 'node:fs';",
      "import { resolve } from 'node:path';",
      "appendFileSync(resolve(import.meta.dirname, '../../runs.log'), String(process.env.PROJECTION_MEASURE ?? 'unset') + String.fromCharCode(10));",
    ].join("\n"),
  );
  await put(directory, "apps/web/src/pricing.ts", "export const price = 10;\n");
  await put(directory, "apps/web/vitest.config.ts", "export default {};\n");
  await put(directory, "apps/web/tests/vitest.setup.ts", "// initial setup\n");
  await put(directory, "apps/web/.env.local", "WEB_FIXTURE=first\n");

  git(directory, "init", "-b", "main");
  git(directory, "config", "user.email", "ci-cache@example.test");
  git(directory, "config", "user.name", "Turbo cache test");
  git(directory, "add", "-A");
  git(directory, "commit", "-m", "fixture");
  return directory;
}

async function runWebTest(directory, envValue = "small") {
  const result = spawnSync(
    turbo,
    [
      "run",
      "test",
      "--filter=@v1/web",
      "--cache-dir",
      join(directory, ".turbo"),
    ],
    {
      cwd: directory,
      encoding: "utf8",
      env: {
        ...process.env,
        PROJECTION_MEASURE: envValue,
        TURBO_CACHE_POLICY_TEST: "configured",
        TURBO_TELEMETRY_DISABLED: "1",
      },
    },
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return `${result.stdout}\n${result.stderr}`;
}

async function runWebBuild(
  directory,
  { skipValidation = "true", convexUrl = "https://example.convex.cloud" } = {},
) {
  const result = spawnSync(
    turbo,
    [
      "run",
      "build",
      "--filter=@v1/web",
      "--cache-dir",
      join(directory, ".turbo"),
    ],
    {
      cwd: directory,
      encoding: "utf8",
      env: {
        ...process.env,
        CI: "true",
        NEXT_PUBLIC_CONVEX_URL: convexUrl,
        SKIP_ENV_VALIDATION: skipValidation,
        TURBO_TELEMETRY_DISABLED: "1",
      },
    },
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return `${result.stdout}\n${result.stderr}`;
}

async function runCount(directory) {
  try {
    return (await readFile(join(directory, "runs.log"), "utf8"))
      .trim()
      .split("\n").length;
  } catch {
    return 0;
  }
}

async function buildRunCount(directory) {
  try {
    return (await readFile(join(directory, "build-runs.log"), "utf8"))
      .trim()
      .split("\n").length;
  } catch {
    return 0;
  }
}

test("installed Turbo reuses web tests, invalidates on source, backend, config, env and patch changes, and ignores CI-only files", async () => {
  const directory = await makeTurboFixture();

  await runWebTest(directory);
  assert.equal(await runCount(directory), 1, "the first run executes the task");
  const hit = await runWebTest(directory);
  assert.match(
    hit,
    /cache hit/i,
    "the same task hash restores from the real Turbo cache",
  );
  assert.equal(
    await runCount(directory),
    1,
    "a cache hit does not execute the test command again",
  );

  await put(directory, "apps/web/src/pricing.ts", "export const price = 11;\n");
  await runWebTest(directory);
  assert.equal(
    await runCount(directory),
    2,
    "web source invalidates its own test task",
  );

  await put(
    directory,
    "packages/backend/convex/utils/featurePolicy.ts",
    "export const policy = 'updated';\n",
  );
  await runWebTest(directory);
  assert.equal(
    await runCount(directory),
    3,
    "the declared backend workspace dependency invalidates web tests",
  );

  await put(
    directory,
    "packages/ui/src/index.ts",
    "export const ui = false;\n",
  );
  await runWebTest(directory);
  assert.equal(
    await runCount(directory),
    4,
    "shared UI source invalidates web tests",
  );

  await put(
    directory,
    "packages/logger/src/index.ts",
    "export const logger = false;\n",
  );
  await runWebTest(directory);
  assert.equal(
    await runCount(directory),
    5,
    "transitive workspace source invalidates web tests",
  );

  const turboConfig = JSON.parse(
    await readFile(join(directory, "turbo.json"), "utf8"),
  );
  turboConfig.globalEnv = ["TURBO_CACHE_POLICY_TEST"];
  await put(
    directory,
    "turbo.json",
    `${JSON.stringify(turboConfig, null, 2)}\n`,
  );
  await runWebTest(directory);
  assert.equal(
    await runCount(directory),
    6,
    "root Turbo policy changes invalidate tests",
  );

  await put(
    directory,
    "biome.json",
    '{"$schema":"fixture","formatter":{"enabled":false}}\n',
  );
  await runWebTest(directory);
  assert.equal(
    await runCount(directory),
    7,
    "root lint configuration changes invalidate tests",
  );

  await put(
    directory,
    "tsconfig.json",
    '{"compilerOptions":{"strict":true}}\n',
  );
  await runWebTest(directory);
  assert.equal(
    await runCount(directory),
    8,
    "root TypeScript configuration changes invalidate tests",
  );

  await put(
    directory,
    "tooling/typescript/base.json",
    '{"compilerOptions":{"strict":false}}\n',
  );
  await runWebTest(directory);
  assert.equal(
    await runCount(directory),
    9,
    "shared TypeScript config changes invalidate tests",
  );

  await put(directory, "apps/web/.env.local", "WEB_FIXTURE=second\n");
  await runWebTest(directory);
  assert.equal(
    await runCount(directory),
    10,
    "ignored local environment files are still hashed",
  );

  await runWebTest(directory, "large");
  assert.equal(
    await runCount(directory),
    11,
    "PROJECTION_MEASURE is passed and hashed in strict Turbo mode",
  );

  await put(directory, "patches/runtime.patch", "updated patch\n");
  await runWebTest(directory, "large");
  assert.equal(
    await runCount(directory),
    12,
    "patch inputs used by postinstall invalidate tasks",
  );

  await put(
    directory,
    "scripts/load-monorepo-env.mjs",
    "// changed command input\n",
  );
  await runWebTest(directory, "large");
  assert.equal(
    await runCount(directory),
    13,
    "root scripts that tasks load invalidate dependent tasks",
  );

  await put(
    directory,
    "scripts/verify-deploy.mjs",
    "// changed deploy check\n",
  );
  await put(directory, ".github/workflows/check.yml", "name: Changed\n");
  await runWebTest(directory, "large");
  assert.equal(
    await runCount(directory),
    13,
    "CI configuration and scripts no task loads keep the cache",
  );

  await put(
    directory,
    "apps/web/vitest.config.ts",
    "export default { test: {} };\n",
  );
  await runWebTest(directory, "large");
  assert.equal(
    await runCount(directory),
    14,
    "Vitest configuration invalidates tests",
  );

  await put(directory, "apps/web/tests/vitest.setup.ts", "// updated setup\n");
  await runWebTest(directory, "large");
  assert.equal(await runCount(directory), 15, "Vitest setup invalidates tests");

  const backendManifest = JSON.parse(
    await readFile(join(directory, "packages/backend/package.json"), "utf8"),
  );
  backendManifest.version = "2.0.0";
  await put(
    directory,
    "packages/backend/package.json",
    JSON.stringify(backendManifest),
  );
  await runWebTest(directory, "large");
  assert.equal(
    await runCount(directory),
    16,
    "dependency manifest changes invalidate tests",
  );
  await runWebTest(directory, "large");
  assert.equal(
    await runCount(directory),
    16,
    "unchanged inputs still hit after mutations",
  );

  await runWebBuild(directory);
  assert.equal(await buildRunCount(directory), 1, "the first build executes");
  assert.match(
    await runWebBuild(directory),
    /cache hit/i,
    "build results use the same local Turbo cache",
  );
  assert.equal(
    await buildRunCount(directory),
    1,
    "the repeated build reuses its artifact",
  );

  await runWebBuild(directory, { convexUrl: "https://changed.convex.cloud" });
  assert.equal(
    await buildRunCount(directory),
    2,
    "NEXT_PUBLIC_CONVEX_URL placeholder changes invalidate build output",
  );
  await runWebBuild(directory, {
    convexUrl: "https://changed.convex.cloud",
    skipValidation: "false",
  });
  assert.equal(
    await buildRunCount(directory),
    3,
    "SKIP_ENV_VALIDATION changes invalidate build output",
  );

  await put(
    directory,
    "packages/backend/convex/utils/featurePolicy.ts",
    "export const policy = 'build-update';\n",
  );
  await runWebBuild(directory, {
    convexUrl: "https://changed.convex.cloud",
    skipValidation: "false",
  });
  assert.equal(
    await buildRunCount(directory),
    4,
    "backend source invalidates cached consumer builds",
  );
});
