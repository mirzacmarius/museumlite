---
name: Museumlite Automation Workflow Prompt
overview: A comprehensive, improved prompt for Cursor Composer Agent to fully automate Museumlite app redesign, functionality completion, and workflow implementation using aura.build, Linear MCP, and Droid CLI.
todos:
  - id: phase-1-audit
    content: "PHASE 1: Complete codebase audit and create Linear project"
    status: pending
  - id: phase-2-architecture
    content: "PHASE 2: Architecture planning and module prioritization"
    status: pending
  - id: phase-3-design
    content: "PHASE 3: Design generation via aura.build for all modules"
    status: pending
  - id: phase-4-implementation
    content: "PHASE 4: Implementation via Droid CLI with Linear tracking"
    status: pending
  - id: phase-5-workflows
    content: "PHASE 5: Workflow integration and approval systems"
    status: pending
  - id: phase-6-docs
    content: "PHASE 6: Documentation and final polish"
    status: pending
---

# Museumlite Automation Workflow - Comprehensive Plan

## Additional Features from Full Application Backlog

### Phase 6: Advanced Features & Infrastructure

#### 6.1 Advanced Search & Filtering

**Objective**: Implement comprehensive search and filtering capabilities

**Tasks**:

1. Full-text search implementation:

- Backend: Use Convex search indexes for collections, objects, loans
- Search across: title, description, accessionNumber, creator, materials, tags
- Frontend: Global search bar in header, search results page
- Files: `packages/backend/convex/search.ts`, `apps/app/src/components/global-search.tsx`

2. Advanced filters:

- Date range filters (created, modified, loan dates)
- Location filters (hierarchical)
- Status filters (active, loaned, deaccessioned)
- Type filters (objectType, objectName, culture, period)
- Boolean operators (AND, OR, NOT)
- Files: `apps/app/src/components/advanced-filters.tsx`

3. Saved searches:

- Save filter combinations for reuse
- Schema: `savedSearches` table (organizationId, userId, name, filters, createdAt)
- Backend: `packages/backend/convex/savedSearches.ts`
- Frontend: Save/load search UI in filter component

4. Export filtered results:

- Export to CSV/JSON
- Include all filtered fields
- Files: `packages/backend/convex/export.ts`

**Success Criteria**: Full-text search works, advanced filters functional, saved searches work, export works

**Dependencies**: Phase 4 (basic implementation complete)

#### 6.2 Reporting & Analytics

**Objective**: Create dashboard analytics and custom reporting

**Tasks**:

1. Dashboard analytics:

- Object counts by status, type, location
- Loan status overview
- Recent activity summary
- Charts/graphs (use recharts or similar)
- Files: `apps/app/src/app/[locale]/(dashboard)/analytics/page.tsx`
- Backend: `packages/backend/convex/analytics.ts`

2. Custom reports builder:

- Select fields to include
- Apply filters
- Choose format (table, list, summary)
- Schedule reports (future enhancement)
- Files: `apps/app/src/app/[locale]/(dashboard)/reports/builder/page.tsx`

3. Pre-built reports:

- Collection catalog report
- Loan report
- Accession report
- Location inventory report

**Success Criteria**: Dashboard shows analytics, custom reports can be created, reports export correctly

**Dependencies**: Phase 4

#### 6.3 Email Notifications

**Objective**: Add email notifications for workflow events

**Tasks**:

1. Email service integration:

- Use Resend (already configured)
- Email templates for workflow events
- Files: `packages/backend/convex/email.ts`, `packages/email/templates/`

2. Notification types:

- Workflow approval requests
- Workflow approved/rejected
- Task assignments
- Loan reminders (upcoming return dates)
- Accession/deaccession status changes

3. User preferences:

- Email notification settings per user
- Opt-in/opt-out per notification type
- Schema: Add `emailPreferences` to users table or separate table

4. Background jobs:

- Scheduled email sending for reminders
- Use Convex scheduled functions or cron

**Success Criteria**: Email notifications sent for workflow events, user preferences work, scheduled emails work

**Dependencies**: Phase 5 (workflows), Resend configured

#### 6.4 Thumbnail Generation

**Objective**: Generate thumbnails for images automatically

**Tasks**:

1. Backend thumbnail generation:

- Use Convex actions or scheduled functions
- Generate thumbnails on media upload
- Store thumbnails in Convex storage
- Update `mediaFiles` table with `thumbnailStorageId`
- Files: `packages/backend/convex/media.ts` (update), `packages/backend/convex/actions/generateThumbnail.ts`

2. Image optimization:

- Multiple sizes (thumbnail, small, medium, large)
- WebP format support
- Lazy loading in gallery
- Files: `apps/app/src/app/[locale]/(dashboard)/objects/[id]/_components/media-gallery.tsx`

3. Background processing:

- Queue system for thumbnail generation
- Progress tracking
- Error handling and retries

**Success Criteria**: Thumbnails generated automatically, multiple sizes available, lazy loading works

**Dependencies**: Phase 4 (media upload)

#### 6.5 Loan Documents

**Objective**: Add document management for loans

**Tasks**:

1. Schema verification:

- Check if `loanDocuments` table exists in schema
- If not, add: organizationId, loanId, storageId, fileName, documentType (agreement, insurance, condition_report, other), uploadedBy, uploadedAt
- Indexes: by_loan, by_organization

2. Backend implementation:

- Upload documents (use Convex storage)
- List documents for loan
- Delete documents
- Files: `packages/backend/convex/loanDocuments.ts`

3. Frontend implementation:

- Document upload UI in loan detail page
- Document list with download/delete
- Document type selector
- Files: `apps/app/src/app/[locale]/(dashboard)/loans/[id]/_components/loan-documents.tsx`

**Success Criteria**: Documents can be uploaded, listed, downloaded, and deleted for loans

**Dependencies**: Phase 4 (loans module)

#### 6.6 API Endpoints

**Objective**: Create RESTful API for external integrations

**Tasks**:

1. API authentication:

- API key management (schema exists: `apiKeys` table)
- Key generation and rotation
- Permission scoping per key
- Files: `packages/backend/convex/apiKeys.ts`, `packages/backend/convex/http.ts`

2. RESTful endpoints:

- Collections API (GET, POST, PUT, DELETE)
- Loans API
- Locations API
- Accessions/Deaccessions API
- Rate limiting
- Files: `packages/backend/convex/http/` directory

3. API documentation:

- OpenAPI/Swagger spec
- Postman collection
- Files: `docs/api/`

4. API key management UI:

- Create/manage API keys in settings
- Show usage statistics
- Files: `apps/app/src/app/[locale]/(dashboard)/settings/api/page.tsx`

**Success Criteria**: API endpoints work, authentication works, documentation complete, UI for key management

**Dependencies**: Phase 4

#### 6.7 Webhooks

**Objective**: Implement webhook system for external integrations

**Tasks**:

1. Backend implementation:

- Webhook registration (schema exists: `webhooks` table)
- Webhook triggering on events
- Retry logic for failed webhooks
- Signature verification
- Files: `packages/backend/convex/webhooks.ts`, `packages/backend/convex/actions/triggerWebhook.ts`

2. Supported events:

- collection.created, collection.updated, collection.deleted
- loan.created, loan.approved, loan.returned
- accession.approved, deaccession.approved
- workflow.step_completed

3. Frontend implementation:

- Webhook management UI in settings
- Create/edit/delete webhooks
- View webhook logs
- Test webhook functionality
- Files: `apps/app/src/app/[locale]/(dashboard)/settings/webhooks/page.tsx`

**Success Criteria**: Webhooks can be created, triggered on events, retry logic works, UI functional

**Dependencies**: Phase 4, Phase 5 (workflows)

#### 6.8 Real-time Polish

**Objective**: Add presence indicators and conflict handling

**Tasks**:

1. Presence indicators:

- Show who is viewing/editing a record
- Use Convex presence API
- Display user avatars/names
- Files: `apps/app/src/components/presence-indicator.tsx`

2. Conflict handling:

- Detect concurrent edits
- Show conflict warnings
- Merge strategies or last-write-wins with warnings
- Files: Update edit pages with conflict detection

3. Optimistic updates:

- Show immediate feedback
- Rollback on error
- Files: Update mutations with optimistic updates

**Success Criteria**: Presence indicators work, conflicts detected and handled, optimistic updates work

**Dependencies**: Phase 4

#### 6.9 Data Validation

**Objective**: Enhance data validation throughout the application

**Tasks**:

1. Accession number uniqueness:

- Validate on create/update
- Check organization scope
- Show clear error messages
- Files: `packages/backend/convex/collections.ts` (update create/update)

2. Required field validation:

- Frontend validation before submit
- Backend validation as safety net
- Clear error messages
- Files: All form components

3. Date consistency checks:

- Loan end date after start date
- Accession date not in future
- Date ranges logical
- Files: Validation helpers in `packages/backend/convex/utils/validation.ts`

4. Location validation:

- Parent location exists
- No circular references
- Location type hierarchy valid
- Files: `packages/backend/convex/locations.ts` (update)

**Success Criteria**: All validations work, clear error messages, data integrity maintained

**Dependencies**: Phase 4

#### 6.10 Performance Optimization

**Objective**: Optimize application performance

**Tasks**:

1. Pagination:

- Ensure all list pages use pagination
- Cursor-based pagination for large datasets
- Page size configuration
- Files: All list pages, backend list functions

2. Query optimization:

- Review all database queries
- Ensure proper indexes exist
- Use indexes in queries
- Files: `packages/backend/convex/schema.ts` (verify indexes), all query functions

3. Caching strategies:

- Cache frequently accessed data
- Use Convex query caching
- Invalidate cache on updates
- Files: Update queries with caching hints

4. Image optimization:

- Lazy loading for images
- Responsive images (srcset)
- WebP format with fallbacks
- Files: Media gallery components

5. Code splitting:

- Lazy load heavy components
- Route-based code splitting
- Files: Update Next.js pages with dynamic imports

**Success Criteria**: Pages load quickly, queries optimized, images lazy loaded, code split properly

**Dependencies**: Phase 4

#### 6.11 Security Enhancements

**Objective**: Strengthen application security

**Tasks**:

1. Input validation and sanitization:

- Validate all user inputs
- Sanitize HTML content
- Prevent XSS attacks
- Files: All mutation handlers, form components

2. Permission checks:

- Verify all mutations check permissions
- Audit permission checks
- Files: All backend mutation functions

3. Rate limiting:

- Implement rate limiting on API endpoints
- Rate limit mutations
- Use Convex rate limiting
- Files: `packages/backend/convex/utils/rateLimit.ts`

4. Audit logging:

- Log all sensitive operations
- Include IP address, user agent
- Files: Ensure all mutations log to auditLog

5. Security headers:

- Configure security headers in Next.js
- CSP headers
- Files: `apps/app/next.config.mjs`

**Success Criteria**: All inputs validated, permissions checked, rate limiting works, audit logging complete

**Dependencies**: Phase 4

#### 6.12 Internationalization

**Objective**: Complete i18n implementation

**Tasks**:

1. Extend locales:

- Add all missing strings to locale files
- Museum-specific terminology
- Files: `apps/app/src/locales/en.ts`, `es.ts`, `fr.ts`

2. Date/time formatting:

- Locale-aware date formatting
- Timezone handling
- Relative time (e.g., "2 days ago")
- Files: Date utility functions

3. Number formatting:

- Locale-aware number formatting
- Currency formatting
- Files: Number utility functions

4. RTL support (if needed):

- Right-to-left language support
- Layout adjustments
- Files: CSS and layout components

**Success Criteria**: All strings translated, dates formatted correctly, numbers formatted correctly

**Dependencies**: Phase 4

#### 6.13 Testing Strategy

**Objective**: Implement comprehensive testing

**Tasks**:

1. Unit tests:

- Test permission logic
- Test validation functions
- Test utility functions
- Files: `packages/backend/convex/__tests__/`, `apps/app/src/__tests__/`

2. Integration tests:

- Test workflows end-to-end
- Test API endpoints
- Test database operations
- Files: `tests/integration/`

3. E2E tests:

- Critical user paths
- Use Playwright or similar
- Files: `tests/e2e/`

4. Test data:

- Seed data for tests
- Test fixtures
- Files: `tests/fixtures/`

**Success Criteria**: Unit tests pass, integration tests pass, E2E tests pass, good test coverage

**Dependencies**: All previous phases

### Phase 7: Documentation & Final Polish

#### 7.1 Code Documentation

- Add JSDoc to all backend functions
- Add JSDoc to complex frontend components
- Document API endpoints
- Document workflow system

#### 7.2 User Documentation

- User guides for each module
- Workflow documentation
- FAQ section
- Video tutorials (optional)

#### 7.3 Developer Documentation

- Architecture overview
- Adding new modules guide
- Workflow system documentation
- Permission system documentation
- API documentation

#### 7.4 Final Polish

- Code cleanup
- Remove unused code
- Optimize bundle size
- Final accessibility audit
- Performance audit