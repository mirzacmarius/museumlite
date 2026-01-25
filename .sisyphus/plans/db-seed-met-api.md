# Database Cleanup & Seed with Met Open Access API

## Context

### Original Request
Clean database and add new data with museum-relevant images from a free image source.

### Interview Summary
**Key Discussions**:
- Image source: The Met Open Access API (CC0, 492K+ artworks, no API key)
- Cleanup scope: **Keep user + auth tables, wipe application data** (user record preserved for seed to work)
- Volume: **Best-effort ~50 objects per org** (target 250, accept any count that runs without error - this is a demo seed, not production data)
- Implementation: New clean seed script (2-file split matching existing pattern), delete old files
- Image storage: Upload to Convex storage (robust)
- Also: Add Philosophy section to AGENTS.md

**Research Findings**:
- Existing seed: `seedFreshAction.ts`, `seedFresh.ts` use Lorem Picsum images
- `seed.ts` uses handcrafted data (no Lorem Picsum) but creates more workflow data (loans, locations, accessions, etc.)
- Met API: `/search?q={keyword}&hasImages=true&isPublicDomain=true` returns accessible images
  - **CRITICAL**: `q=` parameter is REQUIRED, omitting it causes 502 errors
  - Individual keyword queries return 40-85 objects each (verified)
  - Strategy: Use different keywords per org for variety
- Current pattern uploads blobs via `ctx.storage.store()`
- Existing `clearAllData` (seedFresh.ts:1499-1548) wipes 20 tables but NOT `users` or auth tables
- **User email hardcoded**: `mirzacmarius@gmail.com` (verified in seedFreshAction.ts:129)
- Existing pattern: Node actions duplicate constants instead of importing (to avoid bundling issues)

### Metis Review
**Identified Gaps** (addressed):
- Must filter `isPublicDomain=true` - only these have accessible images
- Must validate `primaryImage` non-empty before fetch
- Use `primaryImageSmall` for bandwidth
- Handle partial failures gracefully
- Add rate limit protection (100ms delay between ALL HTTP requests)

---

## Work Objectives

### Core Objective
Replace generic stock photos with real museum artwork images from The Met Open Access API, creating a professional demo dataset.

### Intentional Tradeoff
The new seed script focuses on **collections with real images** and does NOT create:
- Loans, loan items, condition reports
- Accessions, deaccessions
- Locations, location history
- Audit log entries, notifications
- Conservation treatments, exhibitions

This is intentional: the goal is to showcase real museum artwork imagery for demo purposes, not full workflow data. The old `seed.ts` created more workflow data but with Lorem Picsum images or no images at all.

### Concrete Deliverables
- `packages/backend/convex/seedMetAction.ts` - Node action (external API calls)
- `packages/backend/convex/seedMet.ts` - Internal mutations/queries
- `AGENTS.md` - Philosophy section added
- `SEED_DATA_SUMMARY.md` - Updated to reflect new seed command and capabilities
- Old files deleted: `seedFreshAction.ts`, `seedFresh.ts`, `seed.ts`

### Definition of Done
- [x] `npx convex run seedMetAction:resetAndSeed` completes without error
- [x] 5 organizations created
- [x] Each org has ≥1 collection object (best-effort ~50 each, accept lower counts)
- [x] Total collections created logged to console
- [x] Images load in UI (spot-check a few)
- [x] `bun run typecheck` has no NEW failures (known baseline: `@v1/ui` fails on `@xixixao/uploadstuff` - pre-existing, unrelated)
- [x] Old seed files removed

### Must Have
- Met API integration with proper filtering
- Image upload to Convex storage
- Graceful error handling
- Rate limit protection (100ms between ALL HTTP requests)

### Must NOT Have (Guardrails)
- NO storing Met URLs directly (must upload to storage)
- NO creating user records (uses existing user)
- NO wiping `users` table or auth tables (seed requires existing user session)
- NO loans/exhibitions/conservation/location data
- NO infinite retry loops (max 100 attempts per org)
- NO exceeding 10 req/sec (100ms delay between ALL requests)
- NO using `as any` type casts EXCEPT the documented exception in clearAllData for dynamic table iteration (with biome-ignore comment)

---

## Tables Preserved vs Cleared

### Tables PRESERVED (NOT cleared):
- `users` - Required for seed to work
- `authAccounts` - Convex Auth table
- `authSessions` - Convex Auth table  
- `authRefreshTokens` - Convex Auth table
- `authVerificationCodes` - Convex Auth table
- `authVerifiers` - Convex Auth table
- `authRateLimits` - Convex Auth table

### Tables CLEARED (in order):
1. `auditLog`
2. `notifications`
3. `conditionReports`
4. `loanItems`
5. `loanDocuments`
6. `loans`
7. `deaccessions`
8. `accessions`
9. `mediaFiles`
10. `locationHistory`
11. `collectionGroupItems`
12. `collections`
13. `collectionGroups`
14. `locations`
15. `userOrganizations`
16. `rolePermissions`
17. `roles`
18. `organizations`
19. `conservationTreatments`
20. `exhibitions`
21. `_storage` blobs

**Note**: This matches the existing `seedFresh.ts:clearAllData` behavior exactly. Other schema tables (e.g. `accounts`, `contacts`, library tables) are NOT cleared by this seed. They may retain data from prior usage. This seed focuses on org/collection/media data only - not a full database wipe.

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (vitest + convex-test)
- **User wants tests**: Manual verification (seed is ephemeral operation)
- **QA approach**: Manual verification via Convex dashboard + app UI

---

## Task Flow

```
Task 0 (AGENTS.md) → Task 1a (seedMet.ts) + Task 1b (seedMetAction.ts) → Task 2 (verify) → Task 3 (delete old)
```

## Parallelization

| Task | Depends On | Reason |
|------|------------|--------|
| 0 | - | Independent |
| 1a | - | Independent (mutations/queries) |
| 1b | 1a | Action calls seedMet mutations |
| 2 | 1b | Needs both files to exist |
| 3 | 2 | Only delete after verification |

---

## TODOs

- [x] 0. Add Philosophy section to repo root AGENTS.md

  **What to do**:
  - Add Philosophy section to top of repo root `AGENTS.md` (NOT `packages/backend/convex/AGENTS.md`) (after title, before Commands)
  - Content:
    ```markdown
    ## Philosophy
    This codebase will outlive you. Every shortcut becomes someone else's burden. Every hack compounds into technical debt that slows the whole team down.
    You are not just writing code. You are shaping the future of this project. The patterns you establish will be copied. The corners you cut will be cut again.
    Fight entropy. Leave the codebase better than you found it.
    ```

  **Must NOT do**:
  - Change any existing content

  **Parallelizable**: YES (with 1a)

  **References**:
  - Repo root `AGENTS.md` - Existing file to modify (NOT `packages/backend/convex/AGENTS.md`)

  **Acceptance Criteria**:
  - [x] Philosophy section appears after title, before ## Commands
  - [x] Exact wording as specified
  - [x] No other changes to file

  **Commit**: YES
  - Message: `docs(agents): add Philosophy section`
  - Files: `AGENTS.md`

---

- [x] 1a. Create seedMet.ts with internal mutations and queries

  **What to do**:
  - Create `packages/backend/convex/seedMet.ts` containing:
    - `findUserByEmail` internalQuery
    - `clearAllData` internalMutation
    - `createOrganization` internalMutation
    - `assignUserToOrg` internalMutation
    - `createCollection` internalMutation
    - `createMediaFile` internalMutation

  - **File structure** (NO `"use node"`, NO constants export):
    ```typescript
    import { internalMutation, internalQuery } from "./_generated/server";
    import { internal } from "./_generated/api";
    import { v } from "convex/values";
    import type { Id } from "./_generated/dataModel";
    
    // Tables to clear - hardcoded list (NOT using TableNames to avoid as any)
    // These are verified to exist in schema.ts
    const TABLES_TO_CLEAR = [
      "auditLog", "notifications", "conditionReports", "loanItems", "loanDocuments",
      "loans", "deaccessions", "accessions", "mediaFiles", "locationHistory",
      "collectionGroupItems", "collections", "collectionGroups", "locations",
      "userOrganizations", "rolePermissions", "roles", "organizations",
      "conservationTreatments", "exhibitions"
    ] as const;
    ```

  - **clearAllData implementation**:
    ```typescript
    export const clearAllData = internalMutation({
      args: {},
      returns: v.null(),
      handler: async (ctx) => {
        // Clear application tables (NOT users, NOT auth tables)
        for (const tableName of TABLES_TO_CLEAR) {
          try {
            // biome-ignore lint/suspicious/noExplicitAny: required for dynamic table iteration (matches seedFresh.ts pattern)
            const docs = await ctx.db.query(tableName as any).collect();
            for (const doc of docs) {
              await ctx.db.delete(doc._id);
            }
            console.log(`Cleared ${docs.length} records from ${tableName}`);
          } catch (error) {
            console.log(`Skipping ${tableName}: ${error}`);
          }
        }
        // Clear storage
        const storageFiles = await ctx.db.system.query("_storage").collect();
        for (const file of storageFiles) {
          await ctx.storage.delete(file._id);
        }
        console.log(`Cleared ${storageFiles.length} storage files`);
        return null;
      },
    });
    ```
    **Note**: The `tableName as any` pattern matches existing `seedFresh.ts:1529`. This is a known Convex limitation for dynamic table iteration. The biome-ignore comment documents the intentional deviation and prevents lint errors.

  - **createMediaFile fields** (matching existing seedFresh.ts:1733-1750 exactly):
    ```typescript
    export const createMediaFile = internalMutation({
      args: {
        collectionId: v.id("collections"),
        organizationId: v.id("organizations"),
        userId: v.id("users"),
        storageId: v.id("_storage"),
        fileName: v.string(),
        fileSize: v.number(),
        photographer: v.optional(v.string()),
      },
      returns: v.id("mediaFiles"),
      handler: async (ctx, args) => {
        return await ctx.db.insert("mediaFiles", {
          collectionId: args.collectionId,
          organizationId: args.organizationId,
          storageId: args.storageId,
          fileName: args.fileName,
          fileType: "image",
          fileSize: args.fileSize,
          mimeType: "image/jpeg",
          mediaCategory: "image",
          isPrimary: true,
          photographer: args.photographer,
          copyright: args.photographer
            ? `Photo by ${args.photographer}`
            : "Public Domain",  // Matches seedFresh.ts:1746 exactly
          uploadedBy: args.userId,
          uploadedAt: Date.now(),
          uploadStatus: "completed",
        });
      },
    });
    ```

  **Must NOT do**:
  - Use `"use node"` directive (this file has no external API calls)
  - Export ORGANIZATIONS constant (action will duplicate, matching existing pattern)
  - Clear `users` table or any `auth*` tables

  **Parallelizable**: YES (with 0)

  **References**:
  - `packages/backend/convex/seedFresh.ts:1499-1548` - clearAllData pattern (copy structure)
  - `packages/backend/convex/seedFresh.ts:1553-1565` - findUserByEmail (copy exactly)
  - `packages/backend/convex/seedFresh.ts:1570-1640` - createOrganization, assignUserToOrg (copy)
  - `packages/backend/convex/seedFresh.ts:1680-1716` - createCollection fields (copy)
  - `packages/backend/convex/seedFresh.ts:1721-1752` - createMediaFile fields (copy EXACTLY)

  **Acceptance Criteria**:
  - [x] File exists at `packages/backend/convex/seedMet.ts`
  - [x] Does NOT have `"use node";`
  - [x] Does NOT export ORGANIZATIONS constant
  - [x] Exports: `findUserByEmail`, `clearAllData`, `createOrganization`, `assignUserToOrg`, `createCollection`, `createMediaFile`
  - [x] `createMediaFile` copyright field matches seedFresh.ts exactly: `"Public Domain"` not `"Public Domain (CC0)"`
  - [x] `bunx biome check packages/backend/convex/seedMet.ts` passes

  **Commit**: NO (wait for 1b, then commit together)

---

- [x] 1b. Create seedMetAction.ts with Met API integration

  **What to do**:
  - Create `packages/backend/convex/seedMetAction.ts` containing:
    - `"use node";` at top (required for fetch)
    - ORGANIZATIONS constant (duplicated, NOT imported - matches existing pattern)
    - Main `resetAndSeed` internalAction
    - Helper functions for Met API (not exported)

  - **File structure** (DUPLICATE constants, don't import):
    ```typescript
    "use node";
    
    import { internalAction } from "./_generated/server";
    import { internal } from "./_generated/api";
    import { v } from "convex/values";
    import type { Id } from "./_generated/dataModel";
    
    // DUPLICATE org definitions here (matches seedFreshAction.ts pattern)
    // Node runtime requires constants in same file
    const ORGANIZATIONS = [
      { name: "National Museum of Natural History", slug: "natural-history-museum", type: "museum" as const, subscriptionTier: "enterprise" as const, prefix: "NMNH", metQuery: "ancient" },
      { name: "Metropolitan Art Gallery", slug: "metropolitan-art-gallery", type: "gallery" as const, subscriptionTier: "pro" as const, prefix: "MAG", metQuery: "portrait" },
      { name: "Heritage Library & Archives", slug: "heritage-library", type: "library" as const, subscriptionTier: "pro" as const, prefix: "HLA", metQuery: "medieval" },
      { name: "Contemporary Design Museum", slug: "contemporary-design", type: "museum" as const, subscriptionTier: "enterprise" as const, prefix: "CDM", metQuery: "modern" },
      { name: "Vanderbilt Private Collection", slug: "vanderbilt-collection", type: "collector" as const, subscriptionTier: "free" as const, prefix: "VPC", metQuery: "jewelry" },
    ];
    
    // User email (hardcoded, matches existing seedFreshAction.ts:129)
    const SEED_USER_EMAIL = "mirzacmarius@gmail.com";
    ```

  - **Met API integration** (CRITICAL: `q=` param is REQUIRED):
    ```typescript
    interface MetSearchResult { 
      total: number; 
      objectIDs?: number[];  // May be missing if total=0
    }
    interface MetObject { 
      objectID: number; 
      title: string;
      objectName?: string;
      culture?: string;
      period?: string;
      objectDate?: string;
      medium?: string;
      dimensions?: string;
      creditLine?: string;
      department?: string;
      primaryImage?: string;
      primaryImageSmall?: string;
      isPublicDomain: boolean;
    }
    
    // Search with specific keyword (q= is REQUIRED, omitting causes 502)
    async function fetchMetSearch(keyword: string): Promise<number[]> {
      await sleep(100);  // Rate limit BEFORE request
      const url = `https://collectionapi.metmuseum.org/public/collection/v1/search?q=${encodeURIComponent(keyword)}&hasImages=true&isPublicDomain=true`;
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Met search failed: ${response.status}`);
        return [];
      }
      const data: MetSearchResult = await response.json();
      return data.objectIDs ?? [];  // Handle missing objectIDs
    }
    
    async function fetchMetObject(id: number): Promise<MetObject | null> {
      await sleep(100);  // Rate limit BEFORE request
      const url = `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`;
      try {
        const response = await fetch(url);
        if (!response.ok) return null;
        return await response.json();
      } catch {
        return null;
      }
    }
    
    async function fetchImageBlob(url: string): Promise<Blob | null> {
      await sleep(100);  // Rate limit BEFORE request
      try {
        const response = await fetch(url);
        if (!response.ok) return null;
        return await response.blob();
      } catch {
        return null;
      }
    }
    
    function sleep(ms: number): Promise<void> {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
    ```

  - **Seeding algorithm**:
    ```typescript
    export const resetAndSeed = internalAction({
      args: {},
      returns: v.null(),
      handler: async (ctx) => {
        console.log("Starting Met API seed...");
        
        // 1. Find user by email
        const userId = await ctx.runQuery(internal.seedMet.findUserByEmail, { 
          email: SEED_USER_EMAIL 
        });
        if (!userId) {
          console.error(`User ${SEED_USER_EMAIL} not found. Please log in first, then retry.`);
          return null;
        }
        console.log("Found user, proceeding...");
        
        // 2. Clear all data
        console.log("Clearing existing data...");
        await ctx.runMutation(internal.seedMet.clearAllData);
        
        // 3. For each org: query Met API with org-specific keyword, create objects
        for (const org of ORGANIZATIONS) {
          console.log(`\nSeeding ${org.name}...`);
          
          // Create org
          const orgId = await ctx.runMutation(internal.seedMet.createOrganization, {
            name: org.name,
            slug: org.slug,
            type: org.type,
            subscriptionTier: org.subscriptionTier,
          });
          
          // Assign user (finds admin role internally, no roleName param)
          await ctx.runMutation(internal.seedMet.assignUserToOrg, {
            userId,
            organizationId: orgId,
          });
          
          // Fetch Met object IDs for this org's keyword
          const objectIds = await fetchMetSearch(org.metQuery);
          console.log(`Found ${objectIds.length} Met objects for "${org.metQuery}"`);
          
          // Shuffle for variety
          for (let i = objectIds.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [objectIds[i], objectIds[j]] = [objectIds[j], objectIds[i]];
          }
          
          // Seed up to 50 objects
          let successCount = 0;
          let attemptCount = 0;
          const maxAttempts = 100;
          const targetCount = 50;
          
          for (const metId of objectIds) {
            if (successCount >= targetCount || attemptCount >= maxAttempts) break;
            attemptCount++;
            
            // Fetch object details
            const obj = await fetchMetObject(metId);
            if (!obj || !obj.primaryImageSmall) continue;
            
            // Fetch image blob
            const blob = await fetchImageBlob(obj.primaryImageSmall);
            if (!blob) continue;
            
            // Upload to storage
            const storageId = await ctx.storage.store(blob);
            
            // Create collection
            const collectionId = await ctx.runMutation(internal.seedMet.createCollection, {
              organizationId: orgId,
              userId,
              accessionNumber: `${org.prefix}-MET-${metId}`,
              title: obj.title || "Untitled",
              objectType: obj.department || "Art",
              objectName: obj.objectName || obj.title || "Artwork",
              culture: obj.culture || "",
              period: obj.period || "",
              dateCreated: obj.objectDate || "",
              materials: obj.medium || "",
              dimensions: obj.dimensions || "",
              creditLine: obj.creditLine || "The Metropolitan Museum of Art",
            });
            
            // Create mediaFile
            // Note: Met images are typically JPEG; we hardcode this for simplicity
            // Caller omits photographer param (mutation keeps it optional for schema compatibility)
            // When photographer is omitted, copyright defaults to "Public Domain"
            await ctx.runMutation(internal.seedMet.createMediaFile, {
              collectionId,
              organizationId: orgId,
              userId,
              storageId,
              fileName: `${org.prefix}-MET-${metId}.jpg`,
              fileSize: blob.size,
            });
            
            successCount++;
            if (successCount % 10 === 0) {
              console.log(`  ${org.name}: ${successCount}/${targetCount}`);
            }
          }
          
          console.log(`Finished ${org.name}: ${successCount} objects (${attemptCount} attempts)`);
          if (successCount < 10) {
            console.warn(`WARNING: ${org.name} has <10 objects`);
          }
        }
        
        console.log("\nSeed completed!");
        return null;
      },
    });
    ```

  - **User lookup**: Hardcoded email `mirzacmarius@gmail.com` (same as existing seedFreshAction.ts:129)
  - **If user not found**: Log error message asking user to log in first, return early (do NOT throw)
  - **Met API strategy**: One keyword query per org (e.g., "ancient", "portrait", "medieval", "modern", "jewelry") - each returns 40-85 objects which is enough for 50 target
  - **Rate limiting**: 100ms sleep BEFORE each HTTP request (search, object detail, image fetch)

  - **Volume thresholds** (best-effort, not hard requirements):
    - Target: ~50 per org (~250 total)
    - Acceptable: Any count that runs without error (this is demo data)
    - Warning: <10 per org (log warning but continue seeding other orgs)
    - If user not found: Return early with message
    - If Met API returns few results: Log count and continue (don't fail)

  **Must NOT do**:
  - Import ORGANIZATIONS from seedMet (use duplicated constant)
  - Store Met URLs directly in database
  - Create user records
  - Omit `q=` param in Met search URL (causes 502)
  - Skip rate limiting on ANY HTTP request

  **Parallelizable**: NO (depends on 1a for internal mutations)

  **References**:
  - `packages/backend/convex/seedFreshAction.ts:1-265` - Full pattern
    - Lines 8-45: ORGANIZATIONS duplicated in action file (copy this pattern)
    - Line 129: Email hardcoded `mirzacmarius@gmail.com`
    - Lines 115-234: Action structure
    - Lines 241-264: Image fetch returning blob

  **API References**:
  - Met search: `https://collectionapi.metmuseum.org/public/collection/v1/search?q={keyword}&hasImages=true&isPublicDomain=true`
    - `q=` param is **REQUIRED** (verified: omitting causes 502)
    - Returns: `{ total: number, objectIDs?: number[] }`
  - Met object: `https://collectionapi.metmuseum.org/public/collection/v1/objects/{id}`
    - Returns full object with `primaryImageSmall` for images

  **Acceptance Criteria**:
  - [x] File exists at `packages/backend/convex/seedMetAction.ts`
  - [x] Has `"use node";` as first line
  - [x] ORGANIZATIONS constant defined in file (NOT imported)
  - [x] Each org has a `metQuery` field for Met API search
  - [x] Exports only `resetAndSeed` (internalAction)
  - [x] Uses `ctx.runMutation(internal.seedMet.*)` pattern
  - [x] Met search URL includes `q=` parameter
  - [x] 100ms delay before EVERY HTTP request (search, object, image)
  - [x] Max attempts: 100 per org
  - [x] Uses `primaryImageSmall` not `primaryImage`
  - [x] `bunx biome check packages/backend/convex/seedMetAction.ts` passes

  **Commit**: NO (wait for Task 2 verification)

---

- [x] 2. Verify seed works correctly

  **What to do**:
  - **Terminal A** (keep running): `cd packages/backend && npx convex dev`
  - **Terminal B** (run seed): `cd packages/backend && npx convex run seedMetAction:resetAndSeed`
  - Watch console output for progress
  - Verify in Convex dashboard (`https://dashboard.convex.dev`):
    - `organizations` table: 5 records
    - `collections` table: records created (any count > 0)
    - `mediaFiles` table: matches collection count
    - `_storage` table: matches mediaFiles count
  - Verify in app UI:
    - User is still logged in (auth tables preserved)
    - Navigate to dashboard → collections visible
    - Images load correctly (not broken)

  **Must NOT do**:
  - Skip verification steps
  - Proceed to Task 3 if seed throws an error (low counts are OK)
  - Proceed if `bun run typecheck` fails

  **Parallelizable**: NO (depends on 1b)

  **References**:
  - Convex dashboard: `https://dashboard.convex.dev`
  - App: `http://localhost:3000`

  **Acceptance Criteria**:
  - [x] `npx convex run seedMetAction:resetAndSeed` completes without throwing
  - [x] Console logs show progress: "Found X Met objects", "Seeding...", counts per org, final total
  - [x] Convex dashboard shows 5 organizations
  - [x] Convex dashboard shows collections created (any count > 0)
  - [x] Convex dashboard shows mediaFiles matching collection count
  - [x] Each org has ≥1 collection (log warning if <10, but don't fail)
  - [x] App UI: user can access app (auth preserved)
  - [x] App UI: images load in collection views (spot-check a few)
  - [x] `bun run typecheck` has no NEW failures (known baseline: `@v1/ui` fails on `@xixixao/uploadstuff` - pre-existing)

  **Commit**: YES (commit both seedMet.ts and seedMetAction.ts after verification)
  - Message: `feat(seed): add Met Open Access API seed with real artwork images`
  - Files: `packages/backend/convex/seedMet.ts`, `packages/backend/convex/seedMetAction.ts`

---

- [x] 3. Delete old seed files, update docs, regenerate Convex types

  **What to do**:
  1. Delete old files:
     - `rm packages/backend/convex/seedFreshAction.ts`
     - `rm packages/backend/convex/seedFresh.ts`
     - `rm packages/backend/convex/seed.ts`
  2. Update `SEED_DATA_SUMMARY.md` (repo root):
     - Change command from `bunx convex run seed:seedDatabase` to `npx convex run seedMetAction:resetAndSeed`
     - Update "Tables with Demo Data" to reflect new reality:
       - ✅ organizations (5), users, userOrganizations, roles, collections (best-effort ~50/org), mediaFiles (with real Met artwork images)
       - ❌ Remove: loans, loanItems, conditionReports, accessions, deaccessions, locations, locationHistory, auditLog, notifications
     - Update "Functionality That Can Be Tested" section
     - Add note: "This seed focuses on collections with real museum artwork from The Met. Workflow tables (loans, accessions, etc.) are not seeded."
  3. Regenerate Convex types (removes stale references in `_generated/`):
     - `cd packages/backend && npx convex dev --once`
     - OR if dev server running, it auto-regenerates
  4. Verify no broken references remain:
     - `bun run typecheck` has no NEW failures (known baseline: `@v1/ui:typecheck` fails on `@xixixao/uploadstuff` dep - pre-existing, unrelated)
     - Check `packages/backend/convex/_generated/api.d.ts` no longer imports deleted files
     - `grep -R "seed:seedDatabase" .` returns empty (no stale docs)

  **Must NOT do**:
  - Delete files before seed verification passes (Task 2)
  - Leave stale references in `_generated/api.d.ts`
  - Leave `SEED_DATA_SUMMARY.md` with outdated command or capabilities
  - Skip the Convex codegen step

  **Parallelizable**: NO (depends on 2)

  **References**:
  - `packages/backend/convex/seedFreshAction.ts` - File to delete
  - `packages/backend/convex/seedFresh.ts` - File to delete
  - `packages/backend/convex/seed.ts` - File to delete
  - `SEED_DATA_SUMMARY.md` - File to update (repo root)
  - `packages/backend/convex/_generated/api.d.ts` - Auto-generated, will update after deletion

  **Acceptance Criteria**:
  - [x] `packages/backend/convex/seedFreshAction.ts` deleted (file does not exist)
  - [x] `packages/backend/convex/seedFresh.ts` deleted
  - [x] `packages/backend/convex/seed.ts` deleted
  - [x] `SEED_DATA_SUMMARY.md` updated with new command `npx convex run seedMetAction:resetAndSeed`
  - [x] `SEED_DATA_SUMMARY.md` reflects actual seeded tables (no workflow tables)
  - [x] `npx convex dev --once` completes (regenerates types)
  - [x] `bun run typecheck` has no NEW failures (known baseline: `@v1/ui` fails on `@xixixao/uploadstuff` - pre-existing)
  - [x] `grep -r -E "seedFresh(Action)?" packages/backend/convex/ --include="*.ts" | grep -v "_generated"` returns empty
  - [x] `grep -R "seed:seedDatabase" .` returns empty (no stale doc references)
  - [x] `packages/backend/convex/_generated/api.d.ts` does NOT contain `seed`, `seedFresh`, `seedFreshAction` imports

  **Commit**: YES
  - Message: `chore(seed): remove deprecated seed files, update docs (replaced by seedMet)`
  - Files: `-packages/backend/convex/seedFreshAction.ts`, `-packages/backend/convex/seedFresh.ts`, `-packages/backend/convex/seed.ts`, `SEED_DATA_SUMMARY.md`
  - Pre-commit: Verify no new typecheck errors introduced (known baseline failure in @v1/ui is pre-existing)

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 0 | `docs(agents): add Philosophy section` | AGENTS.md | N/A |
| 2 | `feat(seed): add Met Open Access API seed with real artwork images` | seedMet.ts, seedMetAction.ts | Seed runs, images load |
| 3 | `chore(seed): remove deprecated seed files, update docs (replaced by seedMet)` | -3 files, SEED_DATA_SUMMARY.md | typecheck passes, no stale refs |

---

## Success Criteria

### Verification Commands
```bash
# From packages/backend:
npx convex run seedMetAction:resetAndSeed  # Should complete successfully

# From repo root:
bun run typecheck                           # Should pass (turborepo command)

# After Task 3:
grep -r "seedFresh" packages/backend/convex/ --include="*.ts" | grep -v "_generated"  # Should return empty
```

### Final Checklist
- [x] Philosophy section in AGENTS.md
- [x] seedMet.ts + seedMetAction.ts exist and work
- [x] Collections created with real Met artwork images (any count > 0 per org)
- [x] Old seed files deleted
- [x] `SEED_DATA_SUMMARY.md` updated (new command, accurate table list)
- [x] `_generated/api.d.ts` regenerated (no stale imports)
- [x] `grep -R "seed:seedDatabase" .` returns empty
- [x] `bun run typecheck` has no NEW failures (known baseline in @v1/ui pre-existing)
