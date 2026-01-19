# Problems & Blockers - Norwegian i18n Migration

## BLOCKER: Manual Browser Verification (Jan 19, 2026)

### Issue
9 verification tasks require manual browser testing but cannot be automated because:
1. App requires Google OAuth authentication
2. Playwright cannot authenticate without credentials
3. Dashboard pages are protected routes

### Blocked Tasks
1. All 4 locales (en, fr, es, no) work end-to-end
2. Language switcher shows all 4 options
3. All dashboard pages display translated text
4. Dates display in locale-appropriate format (NO: "15. jan. 2024")
5. Numbers/currency display in locale-appropriate format (NO: "1 234")
6. Toast messages display in selected locale

### What Was Verified Automatically
- [x] Dev server runs (localhost:3000 responds with 307 redirect)
- [x] Login page loads successfully
- [x] Norwegian locale file exists (63KB, 1498 keys)
- [x] Norwegian registered in client.ts, server.ts, proxy.ts
- [x] Language switcher component includes "Norsk" option
- [x] All grep verifications pass (0 hardcoded strings remaining)

### Resolution Required
**Human must manually:**
1. Run `bun dev:app`
2. Navigate to http://localhost:3000
3. Log in with Google OAuth
4. Test language switcher dropdown
5. Switch to Norwegian ("Norsk")
6. Verify:
   - UI text displays in Norwegian
   - Dates show "15. jan. 2024" format
   - Numbers show "1 234" format (space separator)
   - Toast messages appear in Norwegian

### Alternative Solutions Considered
1. **Mock authentication**: Would require modifying app code (out of scope)
2. **Test credentials**: Not available
3. **Bypass auth in dev**: Would require code changes (out of scope)

### Status
**BLOCKED** - Awaiting human verification
