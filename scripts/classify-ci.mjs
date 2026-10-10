import { execFileSync } from "node:child_process";
import { appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const FULL = {
  mode: "full",
  app: true,
  web: true,
  backend: true,
  deploy: true,
};

function isDocsPath(path) {
  return (
    (path.startsWith("docs/") && /\.md$/i.test(path)) ||
    /^[^/]+\.md$/i.test(path) ||
    /^(?:\.agents|\.claude)\/skills\/.+\.md$/i.test(path)
  );
}

export function classifyPaths(paths) {
  if (paths.length === 0) return FULL;

  const result = {
    mode: "docs",
    app: false,
    web: false,
    backend: false,
    deploy: false,
  };
  for (const path of paths) {
    if (isDocsPath(path)) continue;
    if (/(?:^|\/)package\.json$/.test(path)) return FULL;
    if (
      /(?:^|\/)(?:bun\.lockb?|package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(
        path,
      )
    ) {
      return FULL;
    }
    if (path.startsWith("apps/app/")) {
      result.app = true;
      continue;
    }
    if (path.startsWith("apps/web/")) {
      result.web = true;
      continue;
    }
    if (path.startsWith("packages/backend/")) {
      result.backend = true;
      result.app = true;
      result.web = true;
      result.deploy = true;
      continue;
    }
    return FULL;
  }

  if (result.app || result.web || result.backend) result.mode = "scoped";
  return result;
}

function git(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "buffer",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function isCommit(revision, cwd) {
  if (
    !revision ||
    /^0+$/.test(revision) ||
    (revision !== "HEAD" && !/^[0-9a-f]{40,64}$/i.test(revision))
  ) {
    return false;
  }
  try {
    git(["cat-file", "-e", `${revision}^{commit}`], cwd);
    return true;
  } catch {
    return false;
  }
}

function changedPaths(before, head, cwd) {
  return git(["diff", "--no-renames", "--name-only", "-z", before, head], cwd)
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
}

export function classifyEvent({
  eventName,
  baseRef,
  before,
  head = "HEAD",
  cwd,
}) {
  if (!isCommit(head, cwd)) return FULL;

  if (eventName === "pull_request") {
    if (!baseRef || !isCommit(baseRef, cwd)) return FULL;
    let base;
    try {
      base = git(["merge-base", baseRef, head], cwd).toString("utf8").trim();
    } catch {
      return FULL;
    }
    if (!base || !isCommit(base, cwd)) return FULL;
    try {
      return classifyPaths(changedPaths(base, head, cwd));
    } catch {
      return FULL;
    }
  }

  if (eventName === "push") {
    if (!isCommit(before, cwd)) return FULL;
    try {
      return classifyPaths(changedPaths(before, head, cwd));
    } catch {
      return FULL;
    }
  }

  return FULL;
}

async function main() {
  const result = classifyEvent({
    eventName: process.env.GITHUB_EVENT_NAME,
    baseRef: process.env.CI_BASE_REF,
    before: process.env.GITHUB_EVENT_BEFORE,
  });
  const output = [
    `node_version=${process.versions.node}`,
    `mode=${result.mode}`,
    `docs_only=${result.mode === "docs"}`,
    `full=${result.mode === "full"}`,
    `app=${result.app}`,
    `web=${result.web}`,
    `backend=${result.backend}`,
    `deploy=${result.deploy}`,
  ].join("\n");

  console.log(`CI scope: ${result.mode}`);
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `${output}\n`);
  } else {
    console.log(output);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await main();
}
