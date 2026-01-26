# Problems - seed-final-step

Currently no unresolved blockers.

## 2026-01-26 - Potential Convex Action Timeout
- Seed action runs for ~3 minutes then fails
- Convex actions have timeout limits (need to verify exact limit)
- Seed includes:
  - Clearing 70+ tables
  - Fetching from Met Museum API (100+ objects across 5 orgs)
  - Creating all seed data
- May need to split into smaller chunks or run differently
- Alternative: Run seed locally with Convex SDK instead of CLI
