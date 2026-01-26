# Learnings - seed-final-step

## 2026-01-26 - Session 1 (Prometheus)
- OCC (OptimisticConcurrencyControlFailure) occurs when multiple transactions conflict
- `locationHistory` table has active writes from running app
- Generic Convex errors don't reveal details - need better error handling
- Batch size of 500 causes more OCC conflicts than 100

## [2026-01-26] Task 2+3: OCC Retry + Error Handling
- Added try-catch to runSeed action for better error visibility
- Implemented exponential backoff retry (3 attempts, 500ms/1s/1.5s delays)
- Reduced batch size from 500 to 100 to minimize OCC conflicts
- Added 100ms inter-batch delay to let concurrent transactions complete
- TypeScript validation: PASSED (seedMetAction.ts has zero errors)
- Both changes applied to same file, ready for single commit

## [2026-01-26 11:15] Tasks 4-5: Verification Complete
- Database was ALREADY seeded from previous run
- All acceptance criteria met:
  - locationHistory: 724 entries ✓
  - Module details present (wine/vehicle/naturalHistory/archive) ✓
  - accountRelationships: 3 ✓
  - objectComments: 1,968 ✓
  - apiKeys/webhooks/scheduledReports: 154/231/231 ✓
- Running resetAndSeed would clear and re-seed (not needed)
- Verification shows all entity relationships populated
