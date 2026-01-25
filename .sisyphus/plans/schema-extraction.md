# Schema Extraction Plan: Collections Table

**STATUS: SUPERSEDED (CLOSED)** - This plan was created as research for the Met seed implementation. The schema information was incorporated into `db-seed-met-api.md` and the seed has been successfully implemented.

## Success Criteria
- [x] Identify all required (non-optional) fields in the `collections` table.
- [x] Identify all foreign key relationships (references to other tables).
- [x] Determine image-related field formats across the collections module.
- [x] Identify the `organizationId` pattern.

## Tasks
- [x] Read `packages/backend/convex/schema.ts` directly.
- [x] ~~Deploy Structural Analysis Agent to verify required fields.~~ (incorporated into seed implementation)
- [x] ~~Deploy Codebase Exploration Agent to map foreign keys.~~ (incorporated into seed implementation)
- [x] ~~Deploy Librarian Agent to verify storage conventions.~~ (incorporated into seed implementation)
- [x] ~~Synthesize findings into structured results.~~ (completed in db-seed-met-api.md)

## Verification
- Cross-reference agent findings with direct file content.
- **DONE**: Seed implementation verified with 67 collections created.
