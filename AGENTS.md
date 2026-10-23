Scope note: the Next.js block below covers UI and routing only. All data, auth, storage, and scheduled work stays in Convex per the rules in this file.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This project runs Next.js 16.4, and its APIs, conventions, and file structure differ from your training data. Before any Next.js UI or routing work, find and read the relevant doc in `node_modules/next/dist/docs/` (resolved from the repository root). Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Coding Agent Guidelines

## Verification policy

- Before pushing, run checks matched to the changed area. Documentation or copy-only changes do not need the full suite; `bun run check` covers everything CI runs except build and loopback deploy.
- For auth, permissions, billing, schema, or shared dependencies, also run the relevant targeted tests and build checks.
- CI (`Check / check` in `.github/workflows/check.yml`) runs automatically on every pull request and push to `main`. A PR is mergeable only when that check has passed on its head commit.

MuseumLite is a museum and library collection-management SaaS. Turborepo monorepo with Convex backend, Next.js 16 App Router, Bun, and Biome.

## Find project guidance

Use [the agent documentation index](docs/agents/README.md). Open only the page for the current task.

- Domain terms and ADRs: [docs/agents/domain.md](docs/agents/domain.md), [GLOSSARY.md](GLOSSARY.md), `docs/adr/`
- Linear intake and handoff: [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md)
- Triage labels: [docs/agents/triage-labels.md](docs/agents/triage-labels.md)
- Local setup, commands, checks: [docs/agents/dev-environment.md](docs/agents/dev-environment.md)
- Code style and UI conventions: [docs/agents/code-style.md](docs/agents/code-style.md)
- Convex navigation: [packages/backend/convex/AGENTS.md](packages/backend/convex/AGENTS.md)
- Convex API rules: `convex/_generated/ai/guidelines.md` (read before backend code)

Convex owns data, auth, storage, and scheduled work. Next.js owns UI and routing. Next.js 16 uses `apps/app/src/proxy.ts`; do not create `middleware.ts`.

Agent skills for Convex, Next.js and Turborepo are committed under `.claude/skills` so cloud sessions have them without a global install. `skills-lock.json` records their sources; refresh them with `npx skills update -p`. They must be real folders, not links: `.agents/skills` is gitignored, so a link into it is empty in every fresh checkout. The root `convex.json` limits Convex's skill installs to `claude-code`, which makes `npx convex ai-files install`/`update` copy into `.claude/skills` instead of linking to `.agents/skills`; when adding skills with `npx skills add`, pass `--agent claude-code` or `--copy`.

The pstack skills (`/poteto-mode`, `/how`, `/why`, `/interrogate`, `/tdd`, the `principle-*` skills and others) and the `poteto-agent` and `comment-sicko` agents are vendored from cursor/plugins, so they are not in `skills-lock.json`. `.claude/docs/pstack/SOURCE.md` records the source commit and local changes, and `.claude/docs/harness/claude-code.md` maps their Cursor names to Claude Code and sets the MuseumLite rules they follow (they never merge PRs).

Matt Pocock's skills (`/ask-matt`, `/grill-with-docs`, `/to-spec`, `/to-tickets`, `/implement`, `/triage`, `/mp-tdd`, `/mp-code-review` and others) are vendored from mattpocock/skills, also outside `skills-lock.json`. `.claude/docs/mattpocock/SOURCE.md` records the source commit and the three renames that avoid clashing with pstack and Claude Code built-ins.

Tickets and acceptance criteria live in Linear (MUS). Do not reintroduce large audit or ticket-draft trees under `docs/`.

## Standing delivery authorization

For MuseumLite coding work or implementation requested from a Linear issue, the user authorizes the normal delivery workflow without a separate fresh confirmation at each step: commit the completed change, run the Standards and Spec review against `CODING_STANDARDS.md` and the Linear issue (in Claude Code the `standards-reviewer` agent in `.claude/agents`, which also stands in for the `mp-code-review` step of `/implement` and `/implement-spec` and runs after the commit there too, so a branch is reviewed once; other agents use the `mp-code-review` skill) on the branch since `origin/main` and fix what it confirms, push the branch, open a pull request, wait for the `Check / check` run on the PR head commit to pass (locally `gh pr checks <pr> --watch`; in Claude Code cloud sessions, where `gh` is not logged in, the PR activity subscription), merge through the repository's normal GitHub controls, and allow the configured Vercel and Convex production deployment to run. Verify that the merged commit serves `https://app.museumlite.com` as `docs/agents/issue-tracker.md` step 3 describes, then post the tester checklist and deployed commit SHA, PR link, and app URL to the Linear issue and move it to `In Review`.

This project-scoped standing authorization takes precedence over optional skill instructions that would otherwise require fresh consent for each merge or routine production deployment, including `convex-deploy-guard`. It does not authorize bypassing branch protection or failed checks, or operations outside this normal delivery workflow. Honor explicit user constraints, identify the correct issue and deployment target, and use deterministic checks before merging. Merge only when the branch is up to date with `main`. When required checks fail, investigate and fix failures within the requested scope, then rerun the required checks and continue once they pass. If a failure or deployment problem remains unresolved, do not bypass it or move the issue to `In Review`; report the blocker and keep the issue `In Progress`. `Done` remains reserved for human or tester validation.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": true` in the root `turbo.json` or `turbo.jsonc` to opt in; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
