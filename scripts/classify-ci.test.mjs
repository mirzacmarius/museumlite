import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { classifyEvent, classifyPaths } from "./classify-ci.mjs";

const temporaryDirectories = [];

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function makeGitFixture() {
  const directory = await mkdtemp(join(tmpdir(), "museumlite-ci-scope-"));
  temporaryDirectories.push(directory);
  execFileSync("git", ["init", "-b", "main"], {
    cwd: directory,
    stdio: "ignore",
  });
  execFileSync("git", ["config", "user.email", "ci-test@example.test"], {
    cwd: directory,
  });
  execFileSync("git", ["config", "user.name", "CI policy test"], {
    cwd: directory,
  });
  return directory;
}

async function commitFile(directory, path, contents, message) {
  const target = join(directory, path);
  await mkdir(join(target, ".."), { recursive: true });
  await writeFile(target, contents);
  execFileSync("git", ["add", "-A"], { cwd: directory });
  execFileSync("git", ["commit", "-m", message], {
    cwd: directory,
    stdio: "ignore",
  });
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: directory,
    encoding: "utf8",
  }).trim();
}

test("workspace classifier keeps docs quick, unions scoped work, and treats unknown paths as full", () => {
  assert.deepEqual(
    classifyPaths(["docs/guide.md", "README.md", ".agents/skills/ci/SKILL.md"]),
    {
      mode: "docs",
      app: false,
      web: false,
      backend: false,
      deploy: false,
    },
  );
  assert.deepEqual(
    classifyPaths(["apps/app/src/page.tsx", "apps/web/src/page.tsx"]),
    {
      mode: "scoped",
      app: true,
      web: true,
      backend: false,
      deploy: false,
    },
  );
  assert.deepEqual(
    classifyPaths(["packages/backend/convex/utils/featurePolicy.ts"]),
    {
      mode: "scoped",
      app: true,
      web: true,
      backend: true,
      deploy: true,
    },
  );
  for (const path of [
    "turbo.json",
    "package.json",
    "apps/web/package.json",
    "packages/backend/package.json",
    "bun.lock",
    "tooling/typescript/base.json",
    "scripts/check.mjs",
    ".github/workflows/check.yml",
    "docs/run.mjs",
    "docs/check.yml",
  ]) {
    assert.equal(
      classifyPaths([path]).mode,
      "full",
      `${path} must not be treated as docs or package-only`,
    );
  }
  assert.equal(
    classifyPaths(["apps/app/ci.sh"]).app,
    true,
    "app executable changes still run app checks",
  );
  assert.equal(
    classifyPaths([]).mode,
    "full",
    "an empty diff must conservatively select all checks",
  );
});

test("push classification handles missing revisions, deletes, and rename paths conservatively", async () => {
  const directory = await makeGitFixture();
  const initial = await commitFile(
    directory,
    "apps/web/old.ts",
    "export const old = true;\n",
    "initial",
  );
  execFileSync("git", ["checkout", "-b", "rename"], {
    cwd: directory,
    stdio: "ignore",
  });
  execFileSync("git", ["mv", "apps/web/old.ts", "README.md"], {
    cwd: directory,
  });
  execFileSync("git", ["commit", "-m", "rename web file to documentation"], {
    cwd: directory,
    stdio: "ignore",
  });
  const renameHead = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: directory,
    encoding: "utf8",
  }).trim();
  const renamed = classifyEvent({
    eventName: "push",
    before: initial,
    head: renameHead,
    cwd: directory,
  });
  assert.equal(
    renamed.web,
    true,
    "--no-renames exposes the old web path even when the new path is docs",
  );
  assert.equal(renamed.mode, "scoped");

  await commitFile(
    directory,
    "packages/backend/convex/schema.ts",
    "export const schema = {};\n",
    "add backend file",
  );
  const beforeDelete = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: directory,
    encoding: "utf8",
  }).trim();
  execFileSync("git", ["rm", "packages/backend/convex/schema.ts"], {
    cwd: directory,
  });
  execFileSync("git", ["commit", "-m", "delete backend file"], {
    cwd: directory,
    stdio: "ignore",
  });
  const deletedHead = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: directory,
    encoding: "utf8",
  }).trim();
  const deleted = classifyEvent({
    eventName: "push",
    before: beforeDelete,
    head: deletedHead,
    cwd: directory,
  });
  assert.equal(
    deleted.backend,
    true,
    "deleting backend source still selects backend checks",
  );
  assert.equal(
    deleted.deploy,
    true,
    "deleting backend source still runs loopback deploy validation",
  );
  assert.equal(deleted.app, true);
  assert.equal(deleted.web, true);

  assert.equal(
    classifyEvent({
      eventName: "push",
      before: "0000000000000000",
      cwd: directory,
    }).mode,
    "full",
  );
  assert.equal(
    classifyEvent({ eventName: "push", before: "not-a-commit", cwd: directory })
      .mode,
    "full",
  );
  assert.equal(
    classifyEvent({
      eventName: "push",
      before: initial,
      head: "missing-head",
      cwd: directory,
    }).mode,
    "full",
  );
});

test("pull request uses merge-base against the checked-out merge result", async () => {
  const directory = await makeGitFixture();
  const base = await commitFile(directory, "README.md", "initial\n", "initial");
  execFileSync("git", ["checkout", "-b", "feature"], {
    cwd: directory,
    stdio: "ignore",
  });
  await commitFile(
    directory,
    "apps/app/src/feature.ts",
    "export const feature = true;\n",
    "feature change",
  );
  const feature = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: directory,
    encoding: "utf8",
  }).trim();
  execFileSync("git", ["checkout", "main"], {
    cwd: directory,
    stdio: "ignore",
  });
  const main = await commitFile(
    directory,
    "apps/web/src/main-change.ts",
    "export const mainChange = true;\n",
    "base-side change",
  );
  execFileSync(
    "git",
    ["merge", "--no-ff", "feature", "-m", "GitHub PR merge result"],
    { cwd: directory, stdio: "ignore" },
  );
  const mergeResult = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: directory,
    encoding: "utf8",
  }).trim();

  const scope = classifyEvent({
    eventName: "pull_request",
    baseRef: base,
    head: mergeResult,
    cwd: directory,
  });
  assert.deepEqual(scope, {
    mode: "scoped",
    app: true,
    web: true,
    backend: false,
    deploy: false,
  });
  assert.notEqual(main, base);
  assert.notEqual(feature, base);
  assert.equal(
    classifyEvent({
      eventName: "pull_request",
      baseRef: "missing-base",
      head: mergeResult,
      cwd: directory,
    }).mode,
    "full",
  );
  assert.equal(
    classifyEvent({
      eventName: "pull_request",
      head: mergeResult,
      cwd: directory,
    }).mode,
    "full",
  );

  const githubOutput = join(directory, "github-output");
  execFileSync(
    process.execPath,
    [fileURLToPath(new URL("./classify-ci.mjs", import.meta.url))],
    {
      cwd: directory,
      env: {
        ...process.env,
        GITHUB_EVENT_NAME: "pull_request",
        CI_BASE_REF: base,
        GITHUB_OUTPUT: githubOutput,
      },
      stdio: "ignore",
    },
  );
  const output = await readFile(githubOutput, "utf8");
  assert.match(output, /docs_only=false/);
  assert.match(output, /full=false/);
  assert.match(output, /app=true/);
  assert.match(output, /web=true/);
});
