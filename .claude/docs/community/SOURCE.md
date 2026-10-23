# Community Convex + Next.js skills (vendored)

Three single skills from [skills.sh](https://www.skills.sh), copied into `.claude/skills/`. They are not in `skills-lock.json`, so `npx skills update -p` leaves them alone.

| Skill | Source | Commit | Licence |
|---|---|---|---|
| `convex-nextjs` | [tristanmanchester/agent-skills](https://github.com/tristanmanchester/agent-skills) `convex-nextjs/` | `878fb404593d082084f9ef3999e69af0c54c45b7` | none stated |
| `nextjs-convex-role-guards` | [purple-orca/skills](https://github.com/purple-orca/skills) `nextjs/nextjs-convex-role-guards/` | `f17105a4a2315e5949ed1c4ef0fc5053734392e9` | MIT, copied as `LICENSE` |
| `polar-sh-nextjs-convex` | [flohhhhh/skills](https://github.com/flohhhhh/skills) `polar-nextjs-convex/` | `dc9a5c55fc317f13222f0952ec84333e7271d77b` | none stated |

`convex-nextjs` was deleted upstream in `b28669d` ("Remove old skills", 2026-09-13), so the copy is its last version, the parent of that commit. skills.sh still lists it.

Local changes:

- Each `SKILL.md` has an "In MuseumLite" section under its title saying where this repo's own rules win: ADR-0004 for access, the existing Polar webhook in `packages/backend/convex/http.ts`, and `packages/backend/convex/AGENTS.md` plus `convex/_generated/ai/guidelines.md` for Convex code.
- `convex-nextjs`: `{baseDir}` replaced with `.claude/skills/convex-nextjs`.
- `polar-sh-nextjs-convex`: the upstream folder is `polar-nextjs-convex`; the folder here uses the skill's `name:`.

None of these skills merges a PR. Merging to `main` follows the standing delivery authorization in `AGENTS.md`.
