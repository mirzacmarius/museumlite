# Convex backend navigation

Follow the shared project rules in `../../../AGENTS.md`. Before writing backend code, read `../../../convex/_generated/ai/guidelines.md` for the Convex API guidelines.

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
| Backend tests | Tests in this directory and `../tests/` |

Run backend tests from `packages/backend/` using `bun test`. Other checks and env notes are in `docs/agents/dev-environment.md`.
