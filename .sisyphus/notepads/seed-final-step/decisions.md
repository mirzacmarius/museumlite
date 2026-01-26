# Decisions - seed-final-step

## 2026-01-26 - OCC Mitigation Strategy
- **Batch size**: Reduced from 500 to 100 (less conflict window)
- **Retry logic**: 3 retries with exponential backoff (500ms, 1s, 1.5s)
- **Inter-batch delay**: 100ms between batches
- **Error handling**: Return error messages from action for debugging
