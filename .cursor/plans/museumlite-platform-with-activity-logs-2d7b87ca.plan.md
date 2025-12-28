---
name: Museumlite Collection Management Platform Implementation Plan
overview: ""
todos:
  - id: 23406888-8d48-40ca-b95b-d95e8b14eeaa
    content: Create listOrganizationActivity query in packages/backend/convex/audit.ts with pagination, entityType filter, date range filter, and month grouping
    status: pending
  - id: 515253ae-c903-4419-aac5-19e8b2450cfd
    content: "Create apps/app/src/app/[locale]/(dashboard)/activity/page.tsx with Vercel-style dark theme layout (black background, two-column: filters left, activity list right)"
    status: pending
  - id: f427c642-9f64-46fc-b634-8bc1e1fc1217
    content: Create activity-filters.tsx component with date range dropdown and collapsible type filter in left sidebar
    status: pending
  - id: 010a2ec8-4b90-4472-87e6-4362573ca3d8
    content: Create activity-list.tsx component that displays month-grouped activity items with pagination
    status: pending
  - id: d1754cd0-06be-4c4b-87ca-0f1e1e7500f3
    content: Create activity-item.tsx component with icon, user action description format, bold key data, right-aligned timestamp
    status: pending
  - id: 3dc3de0f-93f7-461c-a9d0-17e4b8bf0caa
    content: Add Activity link to navigation.tsx with appropriate icon and active state styling
    status: pending
  - id: 4b8453d3-6c1a-45f3-b7fc-6f47d60cb670
    content: Add Activity page UI strings to locale files (en.ts, es.ts, fr.ts)
    status: pending
  - id: 72885956-ac91-4b95-aa3b-13ae9a47703a
    content: Document Vercel-inspired design system rules in repository rules or cursor rules file
    status: pending
---

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

auditLog: Activity tracking
Fields: organizationId, userId, action, entityType, entityId, changes, ipAddress, userAgent, timestamp
Indexes: by_organization, by_user, by_entity, by_timestamp

### Phase 2: Backend Functions

Audit & Notifications (packages/backend/convex/audit.ts)
logAction: Create audit log entry
list: Get audit logs with filters
listOrganizationActivity: Get organization activity logs with pagination, filters (entityType, date range), grouped by month. Returns activity items with user info, action descriptions, timestamps
createNotification: Create user notification
markRead: Mark notification as read
listNotifications: Get user notifications

### Phase 3: Frontend Components & Pages

Layout Updates (apps/app/src/app/[locale]/(dashboard)/)
Update navigation with new menu items: Collections, Loans, Locations, Accessions, Deaccessions, Users, Activity
Add organization switcher component
Add permission-based menu visibility

Activity/Logs UI (apps/app/src/app/[locale]/(dashboard)/activity/)
page.tsx: Activity log page showing all organization changes with Vercel-style dark theme design

- Black background (#000000), white primary text (#FFFFFF), light gray secondary (#A0A0A0)
- Two-column layout: left filter panel, right activity list
- Month-grouped activity items (e.g., "October 2025")
- Each item: icon, user action description with bolded key data, right-aligned relative timestamp
_components/activity-list.tsx: Chronological activity list component with month grouping
_components/activity-filters.tsx: Left sidebar filter panel with date range dropdown ("All Time") and collapsible type filter
_components/activity-item.tsx: Individual activity log item with icon, "You [action]" description format, bold identifiers, right-aligned timestamp

Navigation Update (apps/app/src/app/[locale]/(dashboard)/_components/navigation.tsx)
Add Activity link to navigation bar with appropriate icon (Activity or Clock icon from lucide-react)
Underline active state when on /activity route

### Design System Rules (Vercel-inspired)

Extracted from Activity page design reference:

**Color Scheme:**

- Background: Black (#000000 or very dark gray)
- Primary text: White (#FFFFFF) for headings, main descriptions, active navigation
- Secondary text: Light gray (#A0A0A0) for timestamps, filter labels, less emphasized details
- Borders: Subtle light gray for interactive elements

**Typography:**

- Page titles: Large, bold, white
- Section headers (month groupings): Medium-sized, bold, white
- Body text: Regular weight, white for primary content
- Key identifiers: Bold within descriptions (organization names, IDs, variable names)
- Timestamps: Smaller font, light gray, regular weight

**Layout:**

- Minimalist design with ample whitespace
- Subtle borders, no heavy dividers between list items
- Two-column layout: narrow left panel (filters), wide right panel (content)

**Icons:**

- Simple monochromatic (light gray/white) icons
- Consistent iconography for actions (GitHub Octocat, user icons, etc.)

**Timestamps:**

- Right-aligned
- Light gray color
- Relative format (e.g., "23h", "1d")

**Interactive Elements:**

- Subtle rounded corners
- Dark backgrounds slightly different from main page
- Subtle borders
- Underlined active navigation state

**Filters:**

- Left panel with collapsible sections
- Clear labels
- Date range dropdown with calendar icon
- Type filter with chevron indicators

**Pagination:**

- Centered "Load More" button
- Dark background, white text
- Slightly rounded corners

**Activity Descriptions:**

- Start with "You" (white text)
- Followed by action verb
- Bold important details (names, IDs, variables)

### Key Files to Create/Modify

Backend:

- packages/backend/convex/audit.ts - Add listOrganizationActivity query with pagination and filters

Frontend:

- apps/app/src/app/[locale]/(dashboard)/activity/page.tsx - New Activity page
- apps/app/src/app/[locale]/(dashboard)/activity/_components/activity-list.tsx - Activity list component
- apps/app/src/app/[locale]/(dashboard)/activity/_components/activity-filters.tsx - Filter sidebar
- apps/app/src/app/[locale]/(dashboard)/activity/_components/activity-item.tsx - Activity item component
- apps/app/src/app/[locale]/(dashboard)/_components/navigation.tsx - Add Activity link

Configuration:

- Update locales for Activity page UI strings
- Update repository rules/cursor rules with Vercel-inspired design system guidelines