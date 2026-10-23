# Convex backend navigation

Follow the shared project rules in `../../../AGENTS.md`. Before writing backend code, read `../../../convex/_generated/ai/guidelines.md` for the Convex API guidelines.

Those guidelines target Convex 1.44, but this repo runs 1.38 (`bun.lock`), so check `node_modules/convex` at the repository root before using an API they describe. Read environment variables with `process.env`, mutations included, as the existing code does: `_generated/server` has no `env` export here, and the `convex-env` skill's actions-only rule does not apply. Keep the Vitest environment and the locked test package versions unless the task is an upgrade.

All data, authentication, storage, and scheduled work lives in Convex.

| Task | Location |
| --- | --- |
| Add queries, mutations, or actions | The relevant domain file in this directory |
| Add tables or indexes | `schema.ts` |
| Add HTTP endpoints | `http.ts` |
| Authentication configuration | `auth.ts` |
| Library circulation, holds, fines, acquisitions | `library/` |
| Shared backend helpers | `utils/` |
| Accession number generation | `utils/accessionCounter.ts` |
| Add a kind of Case that can hold Tasks | Its name in `utils/caseTaskValidators.ts`, its definition in `utils/caseTypes.ts` |
| Backend tests | Tests in this directory and `../tests/` |

Run backend tests from `packages/backend/` using `bun run test`; plain `bun test` starts Bun's own runner, which cannot load the Vitest setup. Other checks and env notes are in `docs/agents/dev-environment.md`.

Agents must not run `convex dev`, `convex codegen`, `convex deploy`, `bun dev`, `bun run setup` or `bun run seed` against the linked cloud deployment unless the user explicitly authorizes it. `bun run test` (`convex-test`) needs no cloud; for full-stack work use `bun run convex:local -- <args>` (`scripts/local-qa/README.md`).

That includes the "SELF-VERIFY RULE" in the `convex-expert`, `convex-design` and `convex-quickstart` skills and step 6 of `convex-expert`: don't push to a deployment to check backend work. `bun run typecheck` and `bun run test` from `packages/backend/` are the check, plus `bun run codegen:local` from the repository root, with the local backend running (see `scripts/local-qa/README.md`), when you add, remove or rename a module or change `convex.config.ts`.
