# Museumlite Development - Agent Handoff Prompt

**Date:** 2025-12-29  
**Status:** Active development on P1 Core Modules  
**Last Completed:** MUS-97 (Accounts/CRM module with roles & permissions)

---

## PROJECT CONTEXT

**Museumlite** is a multi-tenant SaaS application for museum/library collection management built with:

- **Backend:** Convex (backend-as-a-service)
- **Frontend:** Next.js 16 App Router with TypeScript
- **Package Manager:** Bun (always use `bun` for commands)
- **UI:** Shadcn UI + Tailwind CSS
- **Monorepo:** Turborepo structure

**Workspace:** `/Users/marius/Developer/ml-convex-sonnet45-droid`  
**Worktree:** `/Users/marius/.cursor/worktrees/ml-convex-sonnet45-droid/veq` (may have sync issues - use main workspace for git)

---

## CRITICAL WORKFLOW - READ THIS FIRST

### Task Completion Workflow

1. **Implement the feature** - Complete all code changes
2. **Ask user for testing confirmation** - "Is this tested and ready to commit?"
3. **If user confirms:**
   - Commit changes to git (from main workspace, not worktree)
   - Update Linear task to "In Review" status
   - Include testing checklist in Linear description

### Git & Linear Workflow

- **Always commit from main workspace:** `/Users/marius/Developer/ml-convex-sonnet45-droid`
- **Commit message format:** `feat([module]): [description] ([TASK-ID])`
- **Linear updates:**
  - Mark as "In Review" when complete (with testing checklist)

### Important Notes

- **DO NOT commit until user explicitly confirms local testing**
- **DO NOT create git commits automatically** - always ask first
- **Worktree sync issues:** If git doesn't detect files in worktree, use main workspace path
- **User preference:** Interactive workflow with permission requests before changes

---

## COMPLETED TASKS

### ✅ MUS-94: Loans workflow verification

- Added "dispatched" loan status
- Dispatch logic, notifications, partial returns
- Developer utility page
- Status: Done

### ✅ MUS-95: Objects delete functionality

- Quick actions dropdown on objects list with deaccession option
- Delete button with confirmation dialog on object detail page
- Soft delete (deaccession) implementation
- Status: Done (committed)

### ✅ MUS-96: Collections delete functionality

- Delete button with confirmation dialog on collection group detail page
- Removes collection group and unlinks associated objects
- Status: Done (committed)

### ✅ MUS-92: Patrons edit page

- Edit page already existed
- Status: In Review

### ✅ MUS-98: Collection Groups management

- Full CRUD UI already existed
- Fixed non-functional Edit button on detail page
- Status: Done

### ✅ MUS-97: Accounts/CRM module

- **Complete CRUD module** for managing lenders, borrowers, institutions, contacts
- **List page:** `/accounts/page.tsx` - Searchable list
- **Detail page:** `/accounts/[id]/page.tsx` - Complete account info
- **New page:** `/accounts/new/page.tsx` - Create form
- **Edit page:** `/accounts/[id]/edit/page.tsx` - Edit form
- **Features:**
  - Account Type field (lender, borrower, both, institution)
  - Roles & Permissions management (many-to-many accountRoles table)
  - Permissions display section on edit page
  - Delete functionality
- **Backend:**
  - `accountType` field in accounts schema
  - `accountRoles` table for many-to-many relationships
  - All mutations/queries updated
- **Status:** Done (committed)

---

## PENDING TASKS (Priority Order)

### P1 Core Modules

1. **MUS-99: Exhibitions module** (P1)
   - Full CRUD + scheduling UI
   - List/detail/new/edit pages
   - Schedule management

2. **Conservation module** (P1)
   - CRUD/treatments UI
   - Treatment history tracking

### Other Pending Tasks (from Linear)

- **MUS-111:** Backup functionality (Excel/XML/CSV export)
- **MUS-110:** Enhanced deaccession workflow (sold/archived/deleted options)
- **MUS-109:** Add Collection field when creating new Object
- **MUS-108:** Fix Accession Number auto-generation error
- **MUS-107:** Fix Physical Description and Provenance tab order
- **MUS-106:** Show object description instead of location in Collection Objects
- **MUS-105:** Fix menu order (Objects and Collections switch places)
- **MUS-90:** Collection edit functionality (Settings button not working)
- **MUS-88:** Library info and features
- **MUS-63:** AI-assisted onboarding
- **MUS-62:** Enhanced deaccession functionality

---

## TECHNICAL ARCHITECTURE

### Project Structure

```
apps/
  app/                          # Main dashboard app
    src/app/[locale]/(dashboard)/
      accounts/                 # ✅ Complete (MUS-97)
      collections/              # ✅ Complete (MUS-98)
      objects/                  # ✅ Delete added (MUS-95)
      loans/                    # ✅ Workflow verified (MUS-94)
      library/patrons/          # ✅ Edit page exists (MUS-92)

packages/
  backend/convex/
    schema.ts                   # Database schema (50+ tables)
    accounts.ts                 # ✅ Complete with accountType & roles
    collections.ts
    loans.ts
    roles.ts
```

### Key Conventions

**Convex Functions:**

- Always use object form: `query({ args, returns, handler })`
- Always include `returns` validator (minimum `v.null()`)
- Use `Id<"tableName">` for document IDs, not `string`
- Use `v.union(v.literal(...))` for discriminated unions

**React/Next.js:**

- RSC-first: minimize `use client`, `useEffect`, `useState`
- Named exports only (no default exports)
- Use `useQuery`, `useMutation` from `convex/react`
- Permission gating: Use `PermissionGate` component

**Permissions:**

- `collections.create`, `collections.update`, `collections.delete`
- `loans.read`, `loans.create`, `loans.update`
- `users.manage_roles`
- Check backend `requirePermission` utility

**Styling:**

- Tailwind CSS with Shadcn UI components
- Dark theme (black background, white text)
- Use `border-white/10` for subtle borders
- Lucide-react icons

### Code Style Rules

See `.cursorrules` and `AGENTS.md` for full details:

- TypeScript strict mode
- Prefer interfaces over types
- Avoid enums (use union types)
- Functional components only
- Error handling early with guard clauses
- Use Zod for form validation

---

## RECENT CODE CHANGES

### Accounts Module (MUS-97) - Latest Implementation

**Schema Changes:**

```typescript
// packages/backend/convex/schema.ts
accounts: defineTable({
  // ... existing fields
  accountType: v.optional(
    v.union(
      v.literal("lender"),
      v.literal("borrower"),
      v.literal("both"),
      v.literal("institution"),
    ),
  ),
  // ...
})

accountRoles: defineTable({
  accountId: v.id("accounts"),
  roleId: v.id("roles"),
  addedAt: v.number(),
  addedBy: v.id("users"),
})
  .index("by_account", ["accountId"])
  .index("by_role", ["roleId"])
  .index("by_account_and_role", ["accountId", "roleId"]),
```

**Backend Mutations:**

- `create`: Accepts `accountType` and `roleIds`, creates accountRoles records
- `update`: Updates `accountType` and replaces accountRoles associations
- `get`: Returns `accountType` and `roleIds` array
- `list`: Returns `accountType`
- `remove`: Deletes associated accountRoles before deleting account

**Frontend:**

- Account Type selector (Select dropdown)
- Roles selection (Checkboxes for roles with loans permissions)
- Permissions display (Read-only, grouped by category on edit page)
- All CRUD pages functional

### User Reverted Changes

**Note:** User has reverted delete functionality from:

- `apps/app/src/app/[locale]/(dashboard)/collections/[id]/page.tsx`
- `apps/app/src/app/[locale]/(dashboard)/objects/[id]/page.tsx`

These were previously implemented but user removed them. Do not re-implement unless explicitly requested.

---

## COMMANDS REFERENCE

```bash
# Development
bun dev              # All apps + backend in parallel
bun dev:app          # Main app only (port 3000)
bun run lint         # Turbo lint + sherif monorepo check
bun run typecheck    # TypeScript check all workspaces
bun run format       # Biome format

# Git (always from main workspace)
cd /Users/marius/Developer/ml-convex-sonnet45-droid
git add [files]
git commit -m "feat([module]): [description] ([TASK-ID])"
```

---

## LINEAR INTEGRATION

**Team:** MuseumLite  
**Project:** Museumlite Development  
**Labels:** `priority-1`, `priority-2`, `backend`, `frontend`, `workflow`

**Workflow:**

1. Check Linear for next task (filter by status: "Todo")
2. Implement feature
3. Update Linear description with testing checklist
4. Mark as "In Review" when complete
5. Ask user for testing confirmation
6. Mark as "Done" after user confirms

**Testing Checklist Template:**

- Navigation tests
- CRUD operation tests
- Permission tests
- Validation tests
- Edge case tests

---

## IMPORTANT GOTCHAS

1. **Worktree Sync Issues:**
   - Git may not detect files in worktree
   - Always use main workspace path: `/Users/marius/Developer/ml-convex-sonnet45-droid`
   - Files exist in main workspace even if worktree doesn't show them

2. **Permission Checks:**
   - Frontend: Use `PermissionGate` component
   - Backend: Use `requirePermission(ctx, permission)` utility
   - Check existing implementations for correct permission names

3. **Convex Validators:**
   - Always include `returns` validator
   - Use `v.optional()` for optional fields
   - Use `v.union()` for discriminated unions
   - Use `v.array()` for arrays

4. **User Preferences:**
   - Interactive workflow (ask before making changes)
   - No automatic git commits
   - Always ask for testing confirmation before committing
   - Provide clear recommendations when asking questions

5. **Code Quality:**
   - Run `bun run lint` before committing
   - Check for TypeScript errors
   - Follow existing code patterns
   - Use existing UI components from `@v1/ui`

---

## NEXT STEPS

1. **Check Linear** for next P1 task (likely MUS-99: Exhibitions module)
2. **Review existing code** patterns in similar modules (accounts, collections)
3. **Implement feature** following established patterns
4. **Create testing checklist** in Linear description
5. **Ask user for testing confirmation** before committing
6. **Commit and update Linear** after confirmation

---

## RESOURCES

- **Project Rules:** `.cursorrules`, `AGENTS.md`
- **Convex Rules:** `.cursor/rules/convex_rules.mdc`
- **Backlog:** `.cursor/plans/museumlite_full_app_backlog_531dfded.plan.md`
- **Linear:** <https://linear.app/museumlite>
- **Convex Docs:** Use MCP context7 server for up-to-date docs

---

## QUESTIONS TO ASK USER

When starting a new task:

1. "Should I proceed with [TASK-ID]: [Task Name]?"
2. "Are there any specific requirements or constraints I should know about?"
3. "Should I follow the same patterns as [similar completed module]?"

When task is complete:

1. "Is this tested and ready to commit?"
2. "Should I proceed with git commit and Linear update?"

---

**Last Updated:** 2025-12-29  
**Agent:** Previous agent completed MUS-97  
**Ready for:** Next P1 task (MUS-99 or Conservation module)
