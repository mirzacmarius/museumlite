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

# Museumlite Automated Development Workflow Prompt

## Current App Analysis (Audit Results)

### Existing Pages (Frontend)

| Module | List | Detail | Edit | New | Status |

|--------|------|--------|------|-----|--------|

| Objects | Yes | Yes | Yes | Yes | Complete |

| Collections | Yes | Yes | **NO** | Yes | Missing Edit |

| Accessions | Yes | Yes | Yes | Yes | Complete + Workflow |

| Deaccessions | Yes | Yes | Yes | Yes | Complete + Workflow |

| Loans | Yes | Yes | Yes | Yes | Complete + Workflow |

| Locations | Yes | Yes | - | - | Tree-based UI |

| Library/Catalog | Yes | Yes | Yes | Yes | Complete |

| Library/Patrons | Yes | Yes | **NO** | Yes | Missing Edit |

| Library/Circulation | Yes | - | - | - | Basic list only |

| Library/Fines | Yes | - | - | - | Basic list only |

| Library/Acquisitions | Yes | - | - | - | Basic list only |

| Activity | Yes | - | - | - | Log viewer |

| Settings | Yes | - | - | - | Multiple sub-pages |

### Backend Tables WITHOUT Frontend UI

1. **collectionGroups** - No UI for managing collection groups
2. **accounts** - No dedicated CRM for lenders/borrowers/institutions
3. **conservationTreatments** - Schema exists, no dedicated tracking UI
4. **exhibitions** - Schema exists, no management UI (only object-level display)
5. **workflowConfigs** - No UI to configure approval workflows
6. **webhooks / apiKeys** - No integration management UI
7. **importJobs** - No bulk import UI

### Critical Missing Functionality (Deep Analysis)

**PRIORITY 1 - Missing Edit/Delete Pages:**

1. **Collections Edit** - Settings button disabled, no way to edit group name/description, collection edit page needs redesign and all collection data as fields
2. **Patrons Edit** - Edit link exists (`/library/patrons/${id}/edit`) but page likely missing
3. **Objects Delete** - No delete functionality in object detail UI
4. **Collections Delete** - No delete for collection groups

**PRIORITY 2 - Missing Core Modules:**

1. **Accounts/CRM Module** - `accounts` table exists, NO frontend pages

                                                                                                                                                                                                - Need: List, Detail, New, Edit pages
                                                                                                                                                                                                - For managing lenders, borrowers, institutions, contacts

2. **Exhibitions Management** - `exhibitions` table exists, only object-level display

                                                                                                                                                                                                - Need: Dedicated `/exhibitions` route with full CRUD
                                                                                                                                                                                                - Schedule, install, deinstall, planning features

3. **Conservation Module** - `conservationTreatments` table exists, only object-level display

                                                                                                                                                                                                - Need: Dedicated `/conservation` route
                                                                                                                                                                                                - Treatment scheduling, condition assessments, reports

**PRIORITY 3 - Workflow & Configuration:**

1. **Workflow Configuration UI** - `workflowConfigs` table exists, NO UI

                                                                                                                                                                                                - Need: Settings page to configure approval steps per workflow type
                                                                                                                                                                                                - Visual workflow builder

2. **Notification Center** - `notifications` table exists, no dedicated UI

                                                                                                                                                                                                - Need: Bell icon in header, notifications panel/page

**PRIORITY 4 - Bulk Operations & Tools:**

1. **Import Tools** - `importJobs` table exists, NO UI

                                                                                                                                                                                                                                                                - CSV import wizard
                                                                                                                                                                                                                                                                - Media bulk upload
                                                                                                                                                                                                                                                                - Progress tracking

2. **Export Tools** - Partial (PDF print exists)

                                                                                                                                                                                                                                                                - CSV export for lists
                                                                                                                                                                                                                                                                - Full collection export
                                                                                                                                                                                                                                                                - Report generation

3. **Bulk Actions** - Missing across all list pages

                                                                                                                                                                                                                                                                - Multi-select with checkboxes
                                                                                                                                                                                                                                                                - Bulk status change, move, delete, export

**PRIORITY 5 - UX/UI Gaps:**

1. **Media Gallery Enhancements**

                                                                                                                                                                                                                                                                - PDF preview in gallery (missing)
                                                                                                                                                                                                                                                                - 3D object viewer (for Sketchfab embeds)
                                                                                                                                                                                                                                                                - Document section in media tab

2. **Keyboard Shortcuts** - None implemented
3. **Global Search** - No cross-module search
4. **Dashboard Widgets** - Main dashboard is basic
5. **Calendar View** - For loans due dates, exhibition schedules

**PRIORITY 6 - New Modules (Future):**

1. **Shipping/Logistics** - Crating, transport, courier management
2. **Inventory/Audit** - Physical inventory tracking workflows
3. **Public Portal** - External-facing collection website
4. **Reports Module** - Custom report builder

---

## Improved Prompt for Cursor Composer Agent

```
You are an autonomous development agent for Museumlite, a museum/collection management platform. Execute the following workflow with minimal user intervention, only requesting confirmation at phase completions.

## TOOLS & RESPONSIBILITIES

| Tool | Responsibility |
|------|---------------|
| **Cursor Agent** | Planning, auditing, analysis, Linear task creation, Droid prompt generation, design review coordination |
| **Droid CLI** | Implementation (frontend + backend), has Linear MCP integrated |
| **aura.build** | UI design generation via browser automation |
| **Linear** | Task management, progress tracking (source of truth for session state) |

## AURA.BUILD INTEGRATION

### Browser Automation Steps:
1. Navigate to https://aura.build/create
2. Reference existing designs in "Recent Chat" sidebar:
   - Museum Collections Admin Dashboard
   - Museum Loans Manager Dashboard  
   - Museum Collection Object Detail Dashboard
   - Logistics Services Landing Page
3. Design style: Classic museum aesthetic + Modern SaaS (elegant, professional, data-focused)
4. Generate design with detailed prompt including:
   - Page purpose and user flow
   - Data fields to display
   - Actions/buttons needed
   - Reference to existing app patterns
5. Copy shareable link
6. Present to user: "Design ready for review: [link]. Reply 'approved' or provide feedback."
7. Wait for approval before implementation

### Design Prompt Template for aura.build:
```

Design a [page type] for a museum collection management system.

Style: Match the existing Museum Collections Admin Dashboard - elegant, professional,

dark mode compatible, modern SaaS aesthetic with museum sophistication.

Page: [Page Name]

Purpose: [What users accomplish here]

Layout:

- [Header with breadcrumbs, title, primary actions]
- [Main content area with specific components]
- [Sidebar if needed]

Data to display:


...

Actions:

- [Button 1]: [what it does]
- [Button 2]: [what it does]

...

States to show: Empty state, Loading, Error, Success

````

---

## WORKFLOW PHASES

### PHASE 1: LINEAR PROJECT SETUP
1. Create Linear project: "Museumlite Development"
2. Create labels: `design`, `frontend`, `backend`, `workflow`, `bug`, `enhancement`
3. Create milestones for each module
4. Output: Linear project link and confirmation

### PHASE 2: TASK CREATION (Module by Module)
Create Linear tasks based on audit findings above. Priority order:

**Priority 1 - Core Fixes:**
- [ ] Collections: Add edit page
- [ ] Patrons: Add edit page
- [ ] Loans: Verify complete workflow (approve, dispatch, return, cancel)

**Priority 2 - New Modules:**
- [ ] Accounts/CRM module (full CRUD)
- [ ] Collection Groups management
- [ ] Exhibitions module (full CRUD + scheduling)
- [ ] Conservation tracking module

**Priority 3 - Enhancements:**
- [ ] Workflow Configuration UI
- [ ] Import/Export tools
- [ ] Media gallery: PDF preview, 3D viewer
- [ ] Shipping/Logistics management
- [ ] Inventory/Audit workflows

**Priority 4 - Integrations:**
- [ ] Calendar integration
- [ ] Email notifications enhancement
- [ ] Barcode/QR scanning UI
- [ ] Public collection portal

### PHASE 3: DESIGN & IMPLEMENTATION CYCLE
For each task (repeat):

1. **Design Phase:**
   - Create Linear sub-task: "Design: [Feature]"
   - Open aura.build via browser
   - Generate design using template above
   - Present link for approval
   - Wait for user response

2. **Implementation Phase (via Droid):**
   Generate Droid prompt:
   ```
   ## Task: [Feature Name]
   **Linear Task:** [ID]
   **Design:** [aura.build link]
   
   ### Frontend
   - Path: apps/app/src/app/[locale]/(dashboard)/[module]/
   - Components: Use @v1/ui (Button, Dialog, Input, etc.)
   - Patterns: Follow existing pages like loans/[id]/page.tsx
   
   ### Backend (if needed)
   - Schema: packages/backend/convex/schema.ts
   - Functions: packages/backend/convex/[module].ts
   - Permissions: Follow requirePermission() pattern
   
   ### Specific Requirements:
   [List from design]
   
   ### Git
   - Branch: feature/[module-feature]
   - Commit message format: "feat([module]): [description]"
   ```

3. **Verification:**
   - Check for linter errors
   - Verify page loads
   - Test basic functionality
   - If errors: Fix (max 2 attempts), then notify user

4. **Update Linear:** Mark task complete

### PHASE 4: WORKFLOW INTEGRATION
For modules with approval workflows:
1. Verify notification triggers exist
2. Test complete workflow: Create -> Submit -> Approve -> Complete
3. Add workflow status badges to list views
4. Implement bulk actions where appropriate

### PHASE 5: DOCUMENTATION & CLEANUP
- Update README with new features
- Add JSDoc comments to complex functions
- Create user guide sections per module
- Run `bun lint` and fix issues
- Merge feature branches to main

---

## ERROR HANDLING

| Scenario | Action |
|----------|--------|
| Implementation error | Attempt fix (max 2 tries) |
| Still broken | Rollback, notify user, continue next task |
| Design rejected | Request specific feedback, regenerate |
| Backend schema conflict | Stop, notify user for decision |

## PHASE COMPLETION OUTPUT

At end of each phase, provide:
````

## Phase [N] Complete

### Completed Tasks

- [x] Task 1
- [x] Task 2

### Linear Updates

- [N] tasks created
- [N] tasks completed

### Next Phase Preview

- Task A
- Task B

### Blockers/Decisions Needed

- [Any issues requiring user input]

Ready to proceed to Phase [N+1]? (yes/no)

```

## SESSION CONTINUITY
- Linear task status O= source of truth
- On session start: Query Linear for incomplete tasks
- Resume from first incomplete task in priority order
```

---

## Key File Paths

| Purpose | Path |

|---------|------|

| Frontend Routes | `apps/app/src/app/[locale]/(dashboard)/` |

| Backend Functions | `packages/backend/convex/` |

| Schema | `packages/backend/convex/schema.ts` |

| UI Components | `packages/ui/src/components/` |

| Shared Utils | `packages/ui/src/utils/` |

## Existing aura.build Designs (Reference)

- Outgoing loans - museumlite.aura.build/outgoing-loans
- Loans overview - museumlite.aura.build/loans-overview, chat: <https://www.aura.build/editor/4c876c2e-23fc-4fea-a78e-6f52bace54f1> and museumlite.aura.build/loans-overview-page, chat: <https://www.aura.build/editor/e885ef40-a7c3-4874-9716-29507d357bea>
- Loans - museumlite.aura.build/outgoing-loans aura chat: <https://www.aura.build/editor/b3b4cce8-ecfc-4715-8779-408407177aff>
- Object - museumlite.aura.build/object, aura chat: <https://www.aura.build/editor/39cf7a71-ff0c-42e3-b56c-6dcaae876b48>
- Dashboard as administrator - museumlite.aura.build/dashboard-as-admin, aura chat: <https://www.aura.build/editor/36524e45-6764-4d14-abab-f8fce77b783c>
