# Issues - seed-final-step

## 2026-01-26 - Seed Failure
- Running `bunx convex run seedMetAction:runSeed` fails with generic "Error"
- Actual error: OCC failure on locationHistory table
- Records keep appearing during clearing (app is active)

## 2026-01-26 - Seed Still Failing After OCC Fix
- Added error handling and OCC retry logic
- Convex deployed successfully (10:48:23, 10:54:10)
- `bunx convex run seedMetAction:runSeed` still returns generic "Error"
- Error handling with try-catch SHOULD return error message as string
- Unclear if error is caught or happening elsewhere
- Need to investigate: logs, alternative testing approach
