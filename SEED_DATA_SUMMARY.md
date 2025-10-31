# Database Seed Data Summary

## Overview
This document summarizes the demo data that has been seeded for the Museumlite application and identifies functionality that requires demo data for testing.

## ✅ Tables with Demo Data

### Core Tables
- **organizations** - 5 demo organizations (Metropolitan Museum, British Museum, Library of Congress, Getty Museum, Smith Collection)
- **users** - Uses existing authenticated user
- **userOrganizations** - User assigned to all organizations as admin
- **roles** - Created via `createDefaultRoles` function
- **collections** - 21 collection objects across all organizations
- **locations** - Hierarchical locations for each organization (buildings, floors, rooms, storage)
- **locationHistory** - Movement tracking entries for collections

### Workflow Tables
- **accessions** - 2 accession records with approved status
- **deaccessions** - 5 deaccession records with various statuses (pending, approved, rejected)
- **loans** - 2 loan records (1 outgoing active, 1 incoming active)
- **loanItems** - Items linked to loans

### Activity & Notifications
- **auditLog** - ✅ **NEW**: Activity log entries for:
  - Collection creation and updates
  - Loan approvals and creation
  - Accession approvals
  - Deaccession approvals
  - Various timestamps (1 day, 3 days, 7 days ago)

- **notifications** - ✅ **NEW**: User notifications for:
  - Pending loan approvals
  - Pending accession approvals
  - Pending deaccession approvals
  - Approved loans (read notifications)
  - Linked to related entities for navigation

### Loan Management
- **conditionReports** - ✅ **NEW**: Condition reports for loan items:
  - Condition "out" reports for active loans
  - Condition "in" reports for older loans
  - Damage assessments

## ⚠️ Tables Without Demo Data (Cannot Be Fully Tested)

### Media Files
- **mediaFiles** - No demo data
  - **Reason**: Requires actual file uploads (storageId)
  - **Impact**: Cannot test media upload functionality, image galleries, or media management
  - **Note**: Would require file storage setup and actual image files

### Loan Documents
- **loanDocuments** - No demo data
  - **Reason**: Requires actual file uploads (storageId)
  - **Impact**: Cannot test loan document upload/management
  - **Note**: Would require file storage setup and actual document files

### Permissions & Roles
- **permissions** - Not seeded
  - **Impact**: May affect permission-based testing
  - **Note**: Permissions are typically created during organization setup

- **rolePermissions** - Not seeded
  - **Impact**: May affect role-based access control testing
  - **Note**: Linked to permissions table

### Workflow Configuration
- **workflowConfigs** - No demo data
  - **Impact**: Cannot test custom workflow configurations
  - **Note**: Workflows may use default configurations

### Integrations
- **webhooks** - No demo data
  - **Impact**: Cannot test webhook integrations
  - **Note**: Advanced feature, not critical for basic testing

- **apiKeys** - No demo data
  - **Impact**: Cannot test API key management
  - **Note**: Advanced feature, not critical for basic testing

- **importJobs** - No demo data
  - **Impact**: Cannot test CSV/media import functionality
  - **Note**: Background job feature

## 🎯 Functionality That Can Now Be Tested

With the new seed data, you can now test:

1. **Activity Page** (`/activity`)
   - View audit log entries
   - Filter by entity type (collection, loan, accession, deaccession)
   - Filter by date range
   - See user information and action details

2. **Notification Bell** (Header component)
   - View unread notifications
   - Mark notifications as read
   - Navigate to related entities
   - See notification counts

3. **Loan Condition Reports**
   - View condition reports for loan items
   - See "out" and "in" condition assessments
   - View damage assessments

4. **Collections**
   - View collections with locations
   - See collection status (active, loaned, deaccessioned)
   - Filter and search collections

5. **Loans**
   - View active loans
   - See loan items
   - View condition reports

6. **Accessions & Deaccessions**
   - View workflow records
   - See various statuses (pending, approved, rejected)
   - View approval history

## 🚫 Functionality That Cannot Be Fully Tested

1. **Media Management**
   - Upload images for collections
   - View image galleries
   - Manage media files
   - Image thumbnails

2. **Loan Documents**
   - Upload loan agreements
   - Upload insurance documents
   - Manage loan-related files

3. **Import/Export**
   - CSV import functionality
   - Media import jobs
   - Export features

4. **Custom Workflows**
   - Custom workflow configurations
   - Multi-step approval workflows

5. **Integrations**
   - Webhook setup and testing
   - API key management

## 📝 Running the Seed Script

To seed the database with demo data:

```bash
cd packages/backend
bunx convex run seed:seedDatabase
```

**Note**: The seed script requires an authenticated user with email `mirzacmarius@gmail.com`. Make sure you're logged in before running the seed script.

## 🔄 Adding More Demo Data

To add demo data for media files or loan documents, you would need to:

1. **For Media Files**:
   - Upload actual image files to Convex storage
   - Create `mediaFiles` records with `storageId` references
   - Link to collections

2. **For Loan Documents**:
   - Upload actual document files to Convex storage
   - Create `loanDocuments` records with `storageId` references
   - Link to loans

These would require file upload functionality and actual files, which is why they're not included in the seed script.

