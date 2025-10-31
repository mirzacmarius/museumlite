# Museumlite Collection Management Platform Implementation Plan

## Architecture Overview

Museumlite will be a multi-tenant SaaS platform built on Convex and Next.js. Each organization (museum, gallery, library, collector) will have isolated data access with role-based permissions. The platform will support complex workflows for collection management, object tracking, and loan operations.

### Phase 1: Database Schema & Multi-Tenancy Foundation

Schema Design (packages/backend/convex/schema.ts)
Core Tables:

organizations: Multi-tenant isolation
Fields: name, slug, type (museum/gallery/library/collector), settings, subscriptionTier
Index: by_slug (unique)
userOrganizations: Many-to-many user-organization relationship with roles
Fields: userId, organizationId, roleId, invitedBy, joinedAt
Indexes: by_user, by_organization, by_user_and_organization (unique)
roles: Role definitions per organization
Fields: organizationId, name, description, isSystemRole (boolean)
Index: by_organization
permissions: Granular permission definitions
Fields: name, description, category (collections/loans/locations/admin)
Index: by_category
rolePermissions: Many-to-many roles-permissions
Fields: roleId, permissionId
Indexes: by_role, by_permission
Collection Management Tables:

collections: Main cataloging table
Fields: organizationId, accessionNumber, title, objectType, objectName, culture, period, dateCreated, materials, dimensions, description, condition, provenance, exhibitionHistory, currentLocationId, status (active/loaned/deaccessioned), catalogedBy, catalogedAt
Indexes: by_organization, by_accessionNumber, by_organization_and_accessionNumber (unique), by_currentLocation, by_status, by_organization_and_status
mediaFiles: Media attachments for objects
Fields: collectionId, organizationId, storageId, fileName, fileType, fileSize, mimeType, isPrimary (boolean), caption, photographer, copyright, uploadedBy, uploadedAt
Indexes: by_collection, by_organization
accessions: Accession workflow records
Fields: organizationId, collectionId, accessionNumber, dateReceived, source, method (purchase/gift/loan/transfer), cost, approvedBy, approvedAt, status (pending/approved/rejected), notes
Indexes: by_organization, by_collection, by_status, by_organization_and_status
deaccessions: Deaccession workflow records
Fields: organizationId, collectionId, deaccessionNumber, dateDeaccessioned, reason, method (sale/donation/destruction/transfer), disposition, approvedBy, approvedAt, status (pending/approved/rejected), notes
Indexes: by_organization, by_collection, by_status, by_organization_and_status
Location Tracking:

locations: Hierarchical location structure
Fields: organizationId, name, type (building/floor/room/cabinet/shelf/box), parentLocationId, address, notes, isActive
Indexes: by_organization, by_parentLocation, by_organization_and_type
locationHistory: Movement tracking
Fields: collectionId, fromLocationId, toLocationId, movedBy, movedAt, reason, notes
Indexes: by_collection, by_toLocation, by_fromLocation, by_movedAt
Loan Management:

loans: Loan records
Fields: organizationId, loanNumber, type (incoming/outgoing), lenderBorrowerName, lenderBorrowerContact, startDate, endDate, status (pending/active/returned/cancelled), terms, insuranceValue, approvedBy, approvedAt, notes
Indexes: by_organization, by_status, by_organization_and_status, by_type, by_organization_and_type
loanItems: Items included in loans
Fields: loanId, collectionId, conditionOut, conditionIn, notes
Indexes: by_loan, by_collection
System Tables:

auditLog: Activity tracking
Fields: organizationId, userId, action, entityType, entityId, changes, ipAddress, userAgent, timestamp
Indexes: by_organization, by_user, by_entity, by_timestamp
notifications: User notifications
Fields: organizationId, userId, type, title, message, read, relatedEntityType, relatedEntityId, createdAt
Indexes: by_user, by_organization, by_user_and_read
System Roles & Permissions
Default System Roles:

super_admin: Full system access (site-wide)
admin: Full organization access
curator: Collection management, accession/deaccession approval
registrar: Accession/deaccession workflows, location management, loans
cataloger: Object cataloging and media management
viewer: Read-only access
Permission Categories:

Collections: create, read, update, delete, approve_accession, approve_deaccession
Loans: create, read, update, delete, approve
Locations: create, read, update, delete
Media: upload, read, delete
Users: invite, manage_roles, remove
Organization: manage_settings, view_analytics

Collection Management Tables:

collections: Main cataloging table
Fields: organizationId, accessionNumber, title, objectType, objectName, culture, period, dateCreated, materials, dimensions, description, condition, provenance, exhibitionHistory, currentLocationId, status (active/loaned/deaccessioned), catalogedBy, catalogedAt
Indexes: by_organization, by_accessionNumber, by_organization_and_accessionNumber (unique), by_currentLocation, by_status, by_organization_and_status
mediaFiles: Media attachments for objects
Fields: collectionId, organizationId, storageId, fileName, fileType, fileSize, mimeType, isPrimary (boolean), caption, photographer, copyright, uploadedBy, uploadedAt
Indexes: by_collection, by_organization
accessions: Accession workflow records
Fields: organizationId, collectionId, accessionNumber, dateReceived, source, method (purchase/gift/loan/transfer), cost, approvedBy, approvedAt, status (pending/approved/rejected), notes
Indexes: by_organization, by_collection, by_status, by_organization_and_status
deaccessions: Deaccession workflow records
Fields: organizationId, collectionId, deaccessionNumber, dateDeaccessioned, reason, method (sale/donation/destruction/transfer), disposition, approvedBy, approvedAt, status (pending/approved/rejected), notes
Indexes: by_organization, by_collection, by_status, by_organization_and_status
Location Tracking:

locations: Hierarchical location structure
Fields: organizationId, name, type (building/floor/room/cabinet/shelf/box), parentLocationId, address, notes, isActive
Indexes: by_organization, by_parentLocation, by_organization_and_type
locationHistory: Movement tracking
Fields: collectionId, fromLocationId, toLocationId, movedBy, movedAt, reason, notes
Indexes: by_collection, by_toLocation, by_fromLocation, by_movedAt
Loan Management:

loans: Loan records
Fields: organizationId, loanNumber, type (incoming/outgoing), lenderBorrowerName, lenderBorrowerContact, startDate, endDate, status (pending/active/returned/cancelled), terms, insuranceValue, approvedBy, approvedAt, notes
Indexes: by_organization, by_status, by_organization_and_status, by_type, by_organization_and_type
loanItems: Items included in loans
Fields: loanId, collectionId, conditionOut, conditionIn, notes
Indexes: by_loan, by_collection
System Tables:

auditLog: Activity tracking
Fields: organizationId, userId, action, entityType, entityId, changes, ipAddress, userAgent, timestamp
Indexes: by_organization, by_user, by_entity, by_timestamp
notifications: User notifications
Fields: organizationId, userId, type, title, message, read, relatedEntityType, relatedEntityId, createdAt
Indexes: by_user, by_organization, by_user_and_read
System Roles & Permissions
Default System Roles:

super_admin: Full system access (site-wide)
admin: Full organization access
curator: Collection management, accession/deaccession approval
registrar: Accession/deaccession workflows, location management, loans
cataloger: Object cataloging and media management
viewer: Read-only access
Permission Categories:

Collections: create, read, update, delete, approve_accession, approve_deaccession
Loans: create, read, update, delete, approve
Locations: create, read, update, delete
Media: upload, read, delete
Users: invite, manage_roles, remove
Organization: manage_settings, view_analytics

### Phase 2: Backend Functions

Organization Management (packages/backend/convex/organizations.ts)
create: Create new organization
get: Get organization by ID
getBySlug: Get organization by slug
update: Update organization settings
listUserOrganizations: Get user's organizations
inviteUser: Invite user to organization
removeUser: Remove user from organization
updateUserRole: Change user's role in organization
Roles & Permissions (packages/backend/convex/roles.ts)
createRole: Create custom role
updateRole: Update role permissions
deleteRole: Delete custom role
listRoles: Get all roles for organization
checkPermission: Verify user has permission
getUserPermissions: Get all permissions for user in organization
Collections (packages/backend/convex/collections.ts)
create: Create new collection object
get: Get object by ID
list: Paginated list with filters (status, location, type, date range)
update: Update object details
delete: Soft delete (mark as deaccessioned)
search: Full-text search across fields
getByAccessionNumber: Find by accession number
Media (packages/backend/convex/media.ts)
generateUploadUrl: Generate presigned URL for upload
create: Create media record after upload
list: Get media for collection object
update: Update media metadata
delete: Remove media file
setPrimary: Set primary image
Accessions (packages/backend/convex/accessions.ts)
create: Create accession record
list: List accessions with filters
get: Get accession details
update: Update accession
approve: Approve and link to collection
reject: Reject accession
Deaccessions (packages/backend/convex/deaccessions.ts)
create: Create deaccession record
list: List deaccessions
get: Get deaccession details
approve: Approve and mark collection as deaccessioned
reject: Reject deaccession
Locations (packages/backend/convex/locations.ts)
create: Create location
list: List locations (hierarchical tree)
get: Get location with children
update: Update location
delete: Soft delete location
moveObject: Move object to new location (creates history)
Loans (packages/backend/convex/loans.ts)
create: Create loan record
addItems: Add objects to loan
removeItems: Remove objects from loan
list: List loans with filters
get: Get loan with items
update: Update loan details
approve: Approve loan
return: Mark loan as returned
cancel: Cancel loan
Audit & Notifications (packages/backend/convex/audit.ts)
logAction: Create audit log entry
list: Get audit logs with filters
createNotification: Create user notification
markRead: Mark notification as read
listNotifications: Get user notifications
Permission Helpers (packages/backend/convex/utils/permissions.ts)
getCurrentUserOrganization: Get user's organization context
requirePermission: Assert user has permission
getUserRole: Get user's role in organization
canAccess: Check if user can access resource

### Phase 3: Frontend Components & Pages

Layout Updates (apps/app/src/app/[locale]/(dashboard)/)
Update navigation with new menu items: Collections, Loans, Locations, Accessions, Deaccessions, Users
Add organization switcher component
Add permission-based menu visibility
Collections UI (apps/app/src/app/[locale]/(dashboard)/collections/)
page.tsx: Collection list with filters, search, pagination
[id]/page.tsx: Object detail page with tabs (Details, Media, History, Loans)
new/page.tsx: Create new object form
_components/collection-list.tsx: Table/grid view component
_components/collection-filters.tsx: Filter sidebar
_components/collection-form.tsx: Create/edit form
_components/object-detail.tsx: Detail view component
_components/media-gallery.tsx: Media display and upload
Accessions UI (apps/app/src/app/[locale]/(dashboard)/accessions/)
page.tsx: Accession list (pending/approved/rejected)
[id]/page.tsx: Accession detail with approval workflow
new/page.tsx: Create accession form
_components/accession-list.tsx: List component
_components/accession-form.tsx: Form component
_components/approval-workflow.tsx: Approval UI
Deaccessions UI (apps/app/src/app/[locale]/(dashboard)/deaccessions/)
Similar structure to accessions
_components/deaccession-form.tsx: Form with reason dropdowns
Locations UI (apps/app/src/app/[locale]/(dashboard)/locations/)
page.tsx: Hierarchical location tree view
[id]/page.tsx: Location detail with objects list
new/page.tsx: Create location form
_components/location-tree.tsx: Tree component
_components/location-form.tsx: Form component
_components/object-mover.tsx: Move object dialog
Loans UI (apps/app/src/app/[locale]/(dashboard)/loans/)
page.tsx: Loans list (incoming/outgoing filters)
[id]/page.tsx: Loan detail with items list
new/page.tsx: Create loan form
_components/loan-list.tsx: List component
_components/loan-form.tsx: Form component
_components/loan-items.tsx: Manage items in loan
_components/loan-approval.tsx: Approval workflow
Settings UI (apps/app/src/app/[locale]/(dashboard)/settings/)
users/page.tsx: User management, invitations, role assignment
roles/page.tsx: Role management, permission assignment
organization/page.tsx: Organization settings
_components/user-list.tsx: User table with roles
_components/invite-user-dialog.tsx: Invitation dialog
_components/role-editor.tsx: Role/permission editor
Shared Components (apps/app/src/components/)
permission-gate.tsx: Conditional rendering based on permissions
organization-switcher.tsx: Switch between organizations
media-upload.tsx: File upload component
location-selector.tsx: Hierarchical location picker
audit-log.tsx: Display audit trail
notification-bell.tsx: Notification center

### Phase 4: Advanced Features

Search & Filtering
Full-text search across all object fields
Advanced filters (date range, location, status, type)
Saved searches
Export filtered results (CSV/JSON)
Workflow Automation
Approval workflows with notifications
Email notifications for workflow events
Task assignment for approvals
Reporting
Dashboard analytics (object counts, loan status, etc.)
Custom reports builder
Export capabilities
Data Validation
Accession number uniqueness validation
Required field validation
Date consistency checks
Location validation

### Phase 5: Infrastructure & Polish

Performance Optimization
Pagination for large datasets
Image optimization (thumbnails, lazy loading)
Query optimization with proper indexes
Caching strategies
Security
Input validation and sanitization
Permission checks on all mutations
Audit logging for sensitive operations
Rate limiting
Internationalization
Extend i18n locales for all new UI
Support for museum-specific terminology
Date/time formatting per locale
Testing Strategy
Unit tests for permission logic
Integration tests for workflows
E2E tests for critical paths
Implementation Order
Schema definition - Complete database schema with all tables and indexes
Multi-tenancy foundation - Organizations, userOrganizations, organization switcher
Permission system - Roles, permissions, permission helpers, permission gates
Collections CRUD - Basic CRUD with real-time subscriptions
Accession numbers - Primary, alternate, history tracking, configurable formats
Media upload - Small file handling (<50MB), large file chunked upload (>50MB)
Thumbnail generation - Background processing for primary images
Location tracking - Hierarchical locations with flexible types
Advanced search - Filters, boolean operators, full-text search
Accession workflow - Configurable approval workflows
Deaccession workflow - Configurable approval workflows
Loan management - Basic loans with configurable condition reports
Loan documents - Document upload and management
Collections UI - Table and card views with toggle
Workflow UI - Approval interfaces for all workflows
Import/Export - CSV import, bulk media upload, export tools
API endpoints - RESTful API with authentication
Webhooks - Webhook management and triggering
Settings UI - Workflow configs, organization settings, integrations
Real-time polish - Presence indicators, conflict handling
Testing - Unit, integration, E2E tests
Documentation - User guides, API docs
Key Files to Create/Modify
Backend:

packages/backend/convex/schema.ts - Complete schema
packages/backend/convex/organizations.ts - New
packages/backend/convex/roles.ts - New
packages/backend/convex/collections.ts - New
packages/backend/convex/media.ts - New
packages/backend/convex/accessions.ts - New
packages/backend/convex/deaccessions.ts - New
packages/backend/convex/locations.ts - New
packages/backend/convex/loans.ts - New
packages/backend/convex/audit.ts - New
packages/backend/convex/utils/permissions.ts - New
Frontend:

All collection management pages and components
All workflow pages and components
Permission-based UI components
Organization switcher and context
Configuration:

Update locales for new UI strings
Add environment variables for file upload limits
Configure storage policies
