# Seed Missing Entity Data

## Context

### Original Request
Fill in all missing entity data for demo database. Objects/collections exist with dates, but relationships to other entities (locations, module-specific details, documents, etc.) are missing.

### Interview Summary
**Key Decisions**:
- Module distribution: Mix across all orgs (with org-type-aware weighting for realism)
- Scope: Everything including low-priority gaps (API keys, webhooks, reports, etc.)
- Location history: Yes, create audit trail when assigning locations

**Research Findings**:
- 5 organizations seeded with ~50 collections each from Met Museum API
- Locations ARE created (hierarchy) but never linked to collections
- Only `fineArtDetails` populated; wine/vehicle/naturalHistory/archive have mutations but ARE NEVER CALLED
- ~15 new mutations needed in seedMet.ts for missing entities
- `locationHistory` IS partially seeded for moves, but NOT for initial placement

### Metis Review
**Identified Gaps** (addressed):
- importHistory/exportHistory tables don't exist → Corrected to `importJobs`/`exportUsage`
- Module distribution should be org-type-aware → Plan includes weighted distribution
- collectionType compatibility must be validated → Plan includes validation step
- 15+ new mutations needed before calling them → Plan phases mutations first

---

## Work Objectives

### Core Objective
Populate all missing entity relationships in the demo database so every feature has realistic seed data to display.

### Concrete Deliverables
1. Modified `packages/backend/convex/seedMet.ts` with ~15 new internal mutations
2. Modified `packages/backend/convex/seedMetAction.ts` with new seeding functions
3. All 250 collections have `currentLocationId` set with location history
4. Module-specific details (wine, vehicle, naturalHistory, archive) populated
5. All document/attachment/relationship tables populated

### Definition of Done
- [x] `bun run typecheck` passes with no errors
- [ ] `bunx convex run seedMetAction.resetAndSeed` completes successfully - **REQUIRES MANUAL EXECUTION**
- [ ] Query verification shows expected record counts per entity type - **REQUIRES MANUAL VERIFICATION**

### Must Have
- Location assignment for all active collections (not loaned/deaccessioned)
- Module details matching collection types
- Account relationships between existing lenders/borrowers
- At least 1 document per loan, exhibition, account
- Conservation alert rules for each organization
- API keys and webhooks records for each organization

### Must NOT Have (Guardrails)
- **No nested array data**: Don't populate serviceLog, partsLifing, eventHistory, provenanceChain arrays
- **No actual file uploads**: Document/attachment records only, no storage operations
- **No working crypto**: API keys use placeholder hashes
- **No HTTP calls**: Webhook records only, no actual firing
- **No modification to existing collections**: Only ADD related records
- **No multiple module details**: One module type per collection maximum
- **No location for loaned items**: Skip collections with status "loaned" or "deaccessioned"

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (vitest configured)
- **User wants tests**: Manual verification (seed data is verified by running seed + queries)
- **Framework**: Manual + convex dashboard queries

### Verification Approach
After each phase, run verification queries via Convex dashboard or CLI:
```bash
bunx convex run seedMet.verifyEntityCounts --args '{"organizationId": "..."}' 
```

---

## Task Flow

```
Phase 1: Mutations (seedMet.ts)
    ↓
Phase 2: Location Assignment (seedMetAction.ts)
    ↓
Phase 3: Module Details (seedMetAction.ts) [can parallel with 4]
    ↓
Phase 4: Relationships & Documents (seedMetAction.ts)
    ↓
Phase 5: Admin Entities (seedMetAction.ts)
    ↓
Phase 6: Library Extension (seedMetAction.ts)
    ↓
Phase 7: Verification Function
```

## Parallelization

| Group | Tasks | Reason |
|-------|-------|--------|
| A | 3, 4 | Independent seeding functions after Phase 1-2 complete |

| Task | Depends On | Reason |
|------|------------|--------|
| 2-7 | 1 | All seeding functions need mutations to exist first |
| 3-6 | 2 | Collections need locations before other relationships |

---

## TODOs

### Phase 1: Add Missing Mutations to seedMet.ts

- [x] 1. Add mutation: `createLocationHistory` (already existed)

  **What to do**:
  - Add new `internalMutation` for creating location history entries
  - Include fields: collectionId, organizationId, fromLocationId (optional), toLocationId, userId, movedAt, reason
  - Follow idempotency pattern: check for existing entry with same collection+timestamp

  **Must NOT do**:
  - Don't create duplicate entries for same move event

  **Parallelizable**: YES (with tasks 2-15)

  **References**:
  - Pattern: `packages/backend/convex/seedMet.ts:245-274` - createCollection mutation pattern
  - Schema: `packages/backend/convex/schema.ts` - locationHistory table definition
  - Usage: `packages/backend/convex/locations.ts:810-850` - how locationHistory is created in production

  **Acceptance Criteria**:
  - [ ] `bun run typecheck` passes in packages/backend
  - [ ] Function signature matches schema exactly

  **Commit**: NO (groups with Phase 1)

---

- [x] 2. Add mutation: `createAccountRelationship`

  **What to do**:
  - Add `internalMutation` for account relationships
  - Fields: organizationId, accountId, relatedAccountId, relationshipType (lender/borrower/donor/vendor/buyer), startDate, notes
  - Idempotency: check for existing relationship between same accounts

  **Must NOT do**:
  - Don't create self-referential relationships (accountId === relatedAccountId)

  **Parallelizable**: YES (with other mutation tasks)

  **References**:
  - Schema: `packages/backend/convex/schema.ts:3527` - accountRelationships table
  - Pattern: `packages/backend/convex/accountRelationships.ts:234-280` - existing create mutation (public)

  **Acceptance Criteria**:
  - [ ] `bun run typecheck` passes
  - [ ] Validates accountId !== relatedAccountId

  **Commit**: NO (groups with Phase 1)

---

- [x] 3. Add mutation: `createAccountDocument`

  **What to do**:
  - Add `internalMutation` for account documents
  - Fields: organizationId, accountId, userId, title, documentType, notes
  - NO actual file upload - just metadata record

  **Must NOT do**:
  - Don't use ctx.storage - document records only

  **Parallelizable**: YES

  **References**:
  - Schema: `packages/backend/convex/schema.ts` - accountDocuments table
  - Pattern: `packages/backend/convex/seedMet.ts:280-320` - createMediaFile pattern (without storage)

  **Acceptance Criteria**:
  - [ ] `bun run typecheck` passes

  **Commit**: NO (groups with Phase 1)

---

- [x] 4. Add mutation: `createExhibitionDocument`

  **What to do**:
  - Add `internalMutation` for exhibition documents
  - Fields: organizationId, exhibitionId, userId, title, documentType (floor_plan/checklist/press_release/catalog)

  **Parallelizable**: YES

  **References**:
  - Schema: `packages/backend/convex/schema.ts` - exhibitionDocuments table

  **Acceptance Criteria**:
  - [ ] `bun run typecheck` passes

  **Commit**: NO (groups with Phase 1)

---

- [x] 5. Add mutation: `createConservationAttachment`

  **What to do**:
  - Add `internalMutation` for conservation attachments
  - Fields: organizationId, treatmentId, userId, title, attachmentType (before_photo/after_photo/report/invoice)

  **Parallelizable**: YES

  **References**:
  - Schema: `packages/backend/convex/schema.ts` - conservationAttachments table

  **Acceptance Criteria**:
  - [ ] `bun run typecheck` passes

  **Commit**: NO (groups with Phase 1)

---

- [x] 6. Add mutation: `createConservationAlertRule`

  **What to do**:
  - Add `internalMutation` for alert rules
  - Fields: organizationId, name, description, conditionField, threshold, comparisonOperator, isActive

  **Parallelizable**: YES

  **References**:
  - Schema: `packages/backend/convex/schema.ts` - conservationAlertRules table

  **Acceptance Criteria**:
  - [ ] `bun run typecheck` passes

  **Commit**: NO (groups with Phase 1)

---

- [x] 7. Add mutation: `createObjectComment`

  **What to do**:
  - Add `internalMutation` for object comments
  - Fields: organizationId, collectionId, userId, content, createdAt

  **Parallelizable**: YES

  **References**:
  - Schema: `packages/backend/convex/schema.ts:3840` - objectComments table
  - Pattern: `packages/backend/convex/objectComments.ts:73-130` - existing public create mutation

  **Acceptance Criteria**:
  - [ ] `bun run typecheck` passes

  **Commit**: NO (groups with Phase 1)

---

- [x] 8. Add mutation: `createConditionDispute`

  **What to do**:
  - Add `internalMutation` for condition disputes
  - Fields: organizationId, loanId, loanItemId, conditionReportId, disputeType, description, status, reportedBy

  **Parallelizable**: YES

  **References**:
  - Schema: `packages/backend/convex/schema.ts` - conditionDisputes table

  **Acceptance Criteria**:
  - [ ] `bun run typecheck` passes

  **Commit**: NO (groups with Phase 1)

---

- [x] 9. Add mutation: `createApiKey`

  **What to do**:
  - Add `internalMutation` for API keys
  - Fields: organizationId, userId, name, keyHash (placeholder string), permissions, expiresAt, isActive

  **Must NOT do**:
  - Don't generate actual crypto keys - use placeholder like "seed_key_hash_placeholder"

  **Parallelizable**: YES

  **References**:
  - Schema: `packages/backend/convex/schema.ts` - apiKeys table

  **Acceptance Criteria**:
  - [ ] `bun run typecheck` passes

  **Commit**: NO (groups with Phase 1)

---

- [x] 10. Add mutation: `createWebhook`

  **What to do**:
  - Add `internalMutation` for webhooks
  - Fields: organizationId, userId, name, url (placeholder), events, secret (placeholder), isActive

  **Must NOT do**:
  - Don't use real URLs - use "https://example.com/webhook/seed"

  **Parallelizable**: YES

  **References**:
  - Schema: `packages/backend/convex/schema.ts` - webhooks table

  **Acceptance Criteria**:
  - [ ] `bun run typecheck` passes

  **Commit**: NO (groups with Phase 1)

---

- [x] 11. Add mutation: `createScheduledReport`

  **What to do**:
  - Add `internalMutation` for scheduled reports
  - Fields: organizationId, userId, reportType, name, schedule, recipients, isActive

  **Parallelizable**: YES

  **References**:
  - Schema: `packages/backend/convex/schema.ts` - scheduledReports table

  **Acceptance Criteria**:
  - [ ] `bun run typecheck` passes

  **Commit**: NO (groups with Phase 1)

---

- [x] 12. Add mutation: `createNotificationPreference`

  **What to do**:
  - Add `internalMutation` for notification preferences
  - Fields: userId, organizationId, categories, emailEnabled, pushEnabled, quietHoursStart, quietHoursEnd

  **Parallelizable**: YES

  **References**:
  - Schema: `packages/backend/convex/schema.ts` - notificationPreferences table

  **Acceptance Criteria**:
  - [ ] `bun run typecheck` passes

  **Commit**: NO (groups with Phase 1)

---

- [x] 13. Add mutation: `createLibraryVendor`

  **What to do**:
  - Add `internalMutation` for library vendors
  - Fields: organizationId, userId, name, contactEmail, contactPhone, address, notes, isActive

  **Parallelizable**: YES

  **References**:
  - Schema: `packages/backend/convex/schema.ts` - libraryVendors table

  **Acceptance Criteria**:
  - [ ] `bun run typecheck` passes

  **Commit**: NO (groups with Phase 1)

---

- [x] 14. Add mutation: `createLibraryAcquisitionRequest`

  **What to do**:
  - Add `internalMutation` for acquisition requests
  - Fields: organizationId, userId, title, author, isbn, requestedBy, reason, status, priority

  **Parallelizable**: YES

  **References**:
  - Schema: `packages/backend/convex/schema.ts` - libraryAcquisitionRequests table

  **Acceptance Criteria**:
  - [ ] `bun run typecheck` passes

  **Commit**: NO (groups with Phase 1)

---

- [x] 15. Add mutation: `createSerialSubscription`

  **What to do**:
  - Add `internalMutation` for serial subscriptions
  - Fields: organizationId, userId, title, issn, vendorId, startDate, renewalDate, status

  **Parallelizable**: YES

  **References**:
  - Schema: `packages/backend/convex/schema.ts` - serialSubscriptions table

  **Acceptance Criteria**:
  - [ ] `bun run typecheck` passes

  **Commit**: NO (groups with Phase 1)

---

- [x] 16. Add mutation: `createSerialIssue`

  **What to do**:
  - Add `internalMutation` for serial issues
  - Fields: organizationId, subscriptionId, issueNumber, volume, publicationDate, receivedDate, status

  **Parallelizable**: YES

  **References**:
  - Schema: `packages/backend/convex/schema.ts` - serialIssues table

  **Acceptance Criteria**:
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(backend): add internal mutations for seed data entities`
  - Files: `packages/backend/convex/seedMet.ts`
  - Pre-commit: `bun run typecheck`

---

### Phase 2: Location Assignment

- [x] 17. Modify `createCollection` to accept `currentLocationId`

  **What to do**:
  - Add `currentLocationId: v.optional(v.id("locations"))` to args
  - Add to insert payload
  - This enables seeding with locations directly

  **Must NOT do**:
  - Don't change return type or other existing behavior

  **Parallelizable**: NO (blocks other tasks)

  **References**:
  - Current: `packages/backend/convex/seedMet.ts:216-274` - createCollection mutation
  - Schema: `packages/backend/convex/schema.ts:327` - currentLocationId field

  **Acceptance Criteria**:
  - [ ] `bun run typecheck` passes
  - [ ] Existing calls still work (field is optional)

  **Commit**: NO (groups with task 18)

---

- [x] 18. Create `seedLocationAssignments()` function in seedMetAction.ts

  **What to do**:
  - Query all collections for organization that have `currentLocationId: null` and `status !== "loaned"` and `status !== "deaccessioned"`
  - Query all locations for organization (filter to rooms/cabinets only)
  - For each eligible collection:
    1. Pick a random location (respecting capacity if tracked)
    2. Update collection with `currentLocationId`
    3. Create locationHistory entry (toLocationId only, no fromLocationId for initial placement)
  - Call after `seedFoundationData()` and before collection creation in resetAndSeed

  **Must NOT do**:
  - Don't assign locations to loaned/deaccessioned items
  - Don't exceed location capacity if tracked

  **Parallelizable**: NO (must complete before other phases)

  **References**:
  - Locations creation: `packages/backend/convex/seedMetAction.ts:1744-1800` - seedFoundationData
  - Collections creation: `packages/backend/convex/seedMetAction.ts:4828-4871` - collection seeding loop
  - Location history pattern: `packages/backend/convex/locations.ts:810-850`

  **Acceptance Criteria**:
  - [ ] All active collections have non-null `currentLocationId`
  - [ ] Each collection has exactly 1 locationHistory entry
  - [ ] No loaned/deaccessioned collections have locations assigned

  **Commit**: YES
  - Message: `feat(backend): assign locations to all seeded collections with history`
  - Files: `packages/backend/convex/seedMet.ts`, `packages/backend/convex/seedMetAction.ts`
  - Pre-commit: `bun run typecheck`

---

### Phase 3: Module Details

- [x] 19. Create `seedModuleDetails()` function in seedMetAction.ts

  **What to do**:
  - Query all collections for organization
  - For collections WITHOUT existing fineArtDetails, assign module type based on org type:
    - Natural History Museum: 70% naturalHistoryDetails, 30% fineArtDetails
    - Art Gallery: 90% fineArtDetails, 10% wineDetails (private collection angle)
    - Heritage Library: 80% archiveDetails, 20% fineArtDetails
    - Design Museum: 70% fineArtDetails, 15% vehicleDetails, 15% wineDetails
    - Private Collection: 40% wineDetails, 30% vehicleDetails, 30% fineArtDetails
  - Create appropriate module detail record with realistic data:
    - wineDetails: vintage (1960-2020), region, varietal, producer, fillLevel, closureType
    - vehicleDetails: VIN (17 chars), make, model, year, mileage, engineType
    - naturalHistoryDetails: taxonomy fields, collectionMethod, preservationMethod
    - archiveDetails: retentionPeriod, confidentialityLevel, ocrProcessed
  - Update collection.collectionType to match the module assigned

  **Must NOT do**:
  - Don't populate nested arrays (serviceLog, partsLifing, eventHistory, provenanceChain)
  - Don't create multiple module types for same collection

  **Parallelizable**: YES (with task 20)

  **References**:
  - Existing fineArtDetails seeding: `packages/backend/convex/seedMetAction.ts:1991-2073`
  - Module mutations: `packages/backend/convex/seedMet.ts:887-1100` - createWineDetails, createVehicleDetails, etc.
  - Schema: `packages/backend/convex/schema.ts:657-890` - all module detail tables

  **Acceptance Criteria**:
  - [ ] Every collection has exactly one module detail record
  - [ ] Module distribution roughly matches org type percentages
  - [ ] collection.collectionType matches assigned module

  **Commit**: YES
  - Message: `feat(backend): seed module-specific details for all collections`
  - Files: `packages/backend/convex/seedMetAction.ts`
  - Pre-commit: `bun run typecheck`

---

### Phase 4: Relationships & Documents

- [x] 20. Create `seedRelationshipsAndDocuments()` function

  **What to do**:
  - **Account Relationships**: For each lender account, create 2-3 relationships to borrower accounts
  - **Loan Documents**: For each loan, create 1-2 documents (loan_agreement, condition_report, insurance_certificate)
  - **Exhibition Documents**: For each exhibition, create 1-2 documents (floor_plan, press_release, checklist)
  - **Account Documents**: For each account, create 1 document (contract, verification_docs)
  - **Conservation Attachments**: For each treatment, create 1-2 attachments (before_photo, after_photo, report)
  - **Object Comments**: For 30% of collections, create 1-3 comments with realistic content
  - **Condition Disputes**: For 10% of returned loans, create 1 dispute record
  - **Conservation Alert Rules**: Create 5 standard alert rules per organization (humidity, temperature, light, UV, age-based)

  **Must NOT do**:
  - Don't create circular relationships
  - Don't duplicate existing records

  **Parallelizable**: YES (with task 19)

  **References**:
  - Accounts: `packages/backend/convex/seedMetAction.ts:1847-1971` - seedAccountsData
  - Loans: `packages/backend/convex/seedMetAction.ts` - seedLoansData function
  - Exhibitions: `packages/backend/convex/seedMetAction.ts` - seedExhibitionsData function
  - Conservation: `packages/backend/convex/seedMetAction.ts` - seedConservationData function

  **Acceptance Criteria**:
  - [ ] Each lender has 2-3 borrower relationships
  - [ ] Each loan has 1-2 documents
  - [ ] Each exhibition has 1-2 documents
  - [ ] Each account has 1 document
  - [ ] Each treatment has 1-2 attachments
  - [ ] ~30% of collections have comments
  - [ ] ~10% of returned loans have disputes
  - [ ] Each org has 5 alert rules

  **Commit**: YES
  - Message: `feat(backend): seed relationships, documents, comments, disputes, and alert rules`
  - Files: `packages/backend/convex/seedMetAction.ts`
  - Pre-commit: `bun run typecheck`

---

### Phase 5: Admin Entities

- [x] 21. Create `seedAdminData()` function

  **What to do**:
  - **API Keys**: Create 2 API keys per organization (read-only, full-access)
  - **Webhooks**: Create 3 webhooks per organization (loan_events, collection_events, alert_events)
  - **Scheduled Reports**: Create 3 scheduled reports per organization (collection_health, loan_status, conservation_summary)
  - **Notification Preferences**: Create preferences for the seed user per organization

  **Must NOT do**:
  - Don't generate actual crypto for API keys
  - Don't use real webhook URLs

  **Parallelizable**: YES (after Phase 2)

  **References**:
  - Schema: `packages/backend/convex/schema.ts` - apiKeys, webhooks, scheduledReports tables

  **Acceptance Criteria**:
  - [ ] Each org has 2 API keys
  - [ ] Each org has 3 webhooks
  - [ ] Each org has 3 scheduled reports
  - [ ] Seed user has notification preferences per org

  **Commit**: YES
  - Message: `feat(backend): seed API keys, webhooks, scheduled reports, notification preferences`
  - Files: `packages/backend/convex/seedMetAction.ts`
  - Pre-commit: `bun run typecheck`

---

### Phase 6: Library Extension

- [x] 22. Extend `seedLibraryData()` function (created seedLibraryExtensions)

  **What to do**:
  - **Library Vendors**: Create 5 vendors per library-type organization
  - **Acquisition Requests**: Create 10 acquisition requests per library org (various statuses)
  - **Serial Subscriptions**: Create 5 active subscriptions per library org
  - **Serial Issues**: Create 3-6 issues per subscription (various receive statuses)

  **Must NOT do**:
  - Don't add to non-library organizations

  **Parallelizable**: YES (after Phase 2)

  **References**:
  - Existing: `packages/backend/convex/seedMetAction.ts` - seedLibraryData function
  - Schema: `packages/backend/convex/schema.ts` - libraryVendors, libraryAcquisitionRequests, serialSubscriptions, serialIssues

  **Acceptance Criteria**:
  - [ ] Heritage Library org has 5 vendors
  - [ ] Heritage Library org has 10 acquisition requests
  - [ ] Heritage Library org has 5 subscriptions with 3-6 issues each

  **Commit**: YES
  - Message: `feat(backend): extend library seed with vendors, acquisitions, serials`
  - Files: `packages/backend/convex/seedMetAction.ts`
  - Pre-commit: `bun run typecheck`

---

### Phase 7: Verification

- [x] 23. Create `verifyEntityCounts` query in seedMet.ts

  **What to do**:
  - Add `internalQuery` that returns counts of all entity types for an organization
  - Return structured object with expected vs actual counts
  - Use this to verify seeding worked correctly

  **Parallelizable**: YES (independent utility)

  **References**:
  - Pattern: `packages/backend/convex/seedMet.ts:112-124` - findUserByEmail query pattern

  **Acceptance Criteria**:
  - [ ] Query returns accurate counts for all 30+ entity types
  - [ ] Can be run via `bunx convex run seedMet.verifyEntityCounts`

  **Commit**: YES
  - Message: `feat(backend): add verification query for seed entity counts`
  - Files: `packages/backend/convex/seedMet.ts`
  - Pre-commit: `bun run typecheck`

---

- [x] 24. Update `resetAndSeed` to call new seeding functions

  **What to do**:
  - After collection creation loop, add calls to:
    1. `seedLocationAssignments(ctx, orgId, userId)`
    2. `seedModuleDetails(ctx, orgId, userId)`
    3. `seedRelationshipsAndDocuments(ctx, orgId, userId)`
    4. `seedAdminData(ctx, orgId, userId)`
  - For library orgs only: call extended seedLibraryData
  - At end, log verification counts

  **Must NOT do**:
  - Don't change existing seeding order for dependencies
  - Don't remove existing seeding functions

  **Parallelizable**: NO (integrates all work)

  **References**:
  - Current: `packages/backend/convex/seedMetAction.ts:4880-4897` - existing seed call order

  **Acceptance Criteria**:
  - [ ] `bunx convex run seedMetAction.resetAndSeed` completes without errors
  - [ ] All new entity types show expected counts in logs

  **Commit**: YES
  - Message: `feat(backend): integrate all new seed functions into resetAndSeed`
  - Files: `packages/backend/convex/seedMetAction.ts`
  - Pre-commit: `bun run typecheck && bunx convex run seedMetAction.resetAndSeed`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 16 | `feat(backend): add internal mutations for seed data entities` | seedMet.ts | `bun run typecheck` |
| 18 | `feat(backend): assign locations to all seeded collections with history` | seedMet.ts, seedMetAction.ts | `bun run typecheck` |
| 19 | `feat(backend): seed module-specific details for all collections` | seedMetAction.ts | `bun run typecheck` |
| 20 | `feat(backend): seed relationships, documents, comments, disputes, and alert rules` | seedMetAction.ts | `bun run typecheck` |
| 21 | `feat(backend): seed API keys, webhooks, scheduled reports, notification preferences` | seedMetAction.ts | `bun run typecheck` |
| 22 | `feat(backend): extend library seed with vendors, acquisitions, serials` | seedMetAction.ts | `bun run typecheck` |
| 23 | `feat(backend): add verification query for seed entity counts` | seedMet.ts | `bun run typecheck` |
| 24 | `feat(backend): integrate all new seed functions into resetAndSeed` | seedMetAction.ts | Full seed run |

---

## Success Criteria

### Verification Commands
```bash
cd packages/backend
bun run typecheck  # Expected: 0 errors
bunx convex run seedMetAction.resetAndSeed  # Expected: completes successfully
bunx convex run seedMet.verifyEntityCounts --args '{"organizationId": "..."}' # Expected: all counts > 0
```

### Final Checklist
- [ ] All collections have currentLocationId set (except loaned/deaccessioned) - **REQUIRES MANUAL DB QUERY**
- [ ] All collections have exactly one module detail record - **REQUIRES MANUAL DB QUERY**
- [ ] All loans have 1-2 documents - **REQUIRES MANUAL DB QUERY**
- [ ] All exhibitions have 1-2 documents - **REQUIRES MANUAL DB QUERY**
- [ ] All accounts have 1 document - **REQUIRES MANUAL DB QUERY**
- [ ] ~30% of collections have comments - **REQUIRES MANUAL DB QUERY**
- [ ] Each org has 5 conservation alert rules - **REQUIRES MANUAL DB QUERY**
- [ ] Each org has 2 API keys, 3 webhooks, 3 scheduled reports - **REQUIRES MANUAL DB QUERY**
- [ ] Library org has vendors, acquisition requests, serial subscriptions - **REQUIRES MANUAL DB QUERY**
- [x] No TypeScript errors
- [ ] Seed completes in reasonable time (<5 minutes) - **REQUIRES MANUAL EXECUTION**
