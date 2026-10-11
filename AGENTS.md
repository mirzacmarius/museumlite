Scope note: the Next.js block below covers UI and routing only. All data, auth, storage, and scheduled work stays in Convex per the rules in this file.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This project runs Next.js 16.2, and its APIs, conventions, and file structure differ from your training data. Before any Next.js UI or routing work, find and read the relevant doc in `node_modules/next/dist/docs/` (resolved from the repository root). Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Coding Agent Guidelines

## Prelaunch verification policy

- Match local checks to the changed area. Documentation or copy-only changes do not need the full suite.
- For auth, permissions, billing, schema, or shared dependencies, run the relevant targeted tests and build checks.
- Run the full manual CI workflow for a release candidate or when a risky change specifically calls for it: `gh workflow run check.yml --ref <branch>`.
- CI no longer runs automatically on pushes or pull requests; do not wait for automatic checks.

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

Convex skills stay in the global install or Convex plugin. Do not duplicate them under `.agents/skills` or `.claude/skills`.

Tickets and acceptance criteria live in Linear (MUS). Do not reintroduce large audit or ticket-draft trees under `docs/`.

## Standing delivery authorization

For MuseumLite coding work or implementation requested from a Linear issue, the user authorizes the normal delivery workflow without a separate fresh confirmation at each step: commit the completed change, push the branch, open a pull request, wait for all required checks to pass, review the resulting diff, merge through the repository's normal GitHub controls, and allow the configured Vercel and Convex production deployment to run. Verify that the merged commit successfully serves `https://app.museumlite.com`, then post the tester checklist and deployed commit SHA, PR link, and app URL to the Linear issue and move it to `In Review`.

This project-scoped standing authorization takes precedence over optional skill instructions that would otherwise require fresh consent for each merge or routine production deployment, including `convex-deploy-guard`. It does not authorize bypassing branch protection or failed checks, or operations outside this normal delivery workflow. Honor explicit user constraints, identify the correct issue and deployment target, and use deterministic checks before merging. When required checks fail, investigate and fix failures within the requested scope, then rerun the required checks and continue once they pass. If a failure or deployment problem remains unresolved, do not bypass it or move the issue to `In Review`; report the blocker and keep the issue `In Progress`. `Done` remains reserved for human or tester validation.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Optional Convex skills come from global installations or plugins; do not install duplicate project copies.

<!-- convex-ai-end -->
