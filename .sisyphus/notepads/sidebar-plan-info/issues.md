well # Issues - Sidebar Plan Information

## [2026-01-26] Problems Encountered

### LSP Import Warnings
**Issue**: LSP complains about missing `.js` extensions in test imports
**Error**: "Relative import paths need explicit file extensions"
**Resolution**: Ignored - tests run fine with `bun test` despite warnings
**Root Cause**: TypeScript moduleResolution setting vs actual runtime behavior
**Impact**: None - tests pass, no runtime errors

### Type Mismatch: null vs undefined
**Issue**: `currentOrganizationId` is `Id | null` but component expects `Id | undefined`
**Error**: "Type 'null' is not assignable to type 'Id | undefined'"
**Resolution**: Convert with `currentOrganizationId ?? undefined`
**Lesson**: Context providers often use `null`, React components prefer `undefined`

### Organization Create Mutation Args
**Issue**: Initial tests tried to pass `subscriptionTier` to `create` mutation
**Error**: "Unexpected field `subscriptionTier` in object"
**Resolution**: Use `t.run()` to insert directly into DB with all fields
**Lesson**: Check mutation validators before writing tests

### Authentication in Tests
**Issue**: Mutations require authenticated user context
**Error**: "Not authenticated"
**Resolution**: Use `t.run()` for direct DB access (bypasses auth)
**Alternative**: Use `t.withIdentity()` for testing auth-dependent mutations
**Lesson**: Choose test approach based on what you're testing (query logic vs auth)

### Background Task Failures
**Issue**: Delegated tasks failed with errors
**Error**: Tasks returned "error" status with 0s duration
**Resolution**: Implemented directly instead of delegating
**Lesson**: Simple implementation tasks may be faster to do directly than debug delegation
