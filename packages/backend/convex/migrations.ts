import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";

/**
 * Migration: Backfill sortOrder field for existing locations
 *
 * This migration adds the sortOrder field to all existing locations.
 * Locations are ordered by their creation time within each parent.
 *
 * Run this migration via Convex dashboard or CLI:
 * npx convex run migrations:backfillLocationSortOrder
 */
export const backfillLocationSortOrder = internalMutation({
  handler: async (ctx) => {
    console.log("Starting migration: Backfill sortOrder for locations");

    const allLocations = await ctx.db.query("locations").collect();
    console.log(`Found ${allLocations.length} locations`);

    // Group locations by organizationId and parentLocationId
    const locationsByParent = new Map<string, typeof allLocations>();

    for (const location of allLocations) {
      const key = `${location.organizationId}:${location.parentLocationId || "root"}`;
      if (!locationsByParent.has(key)) {
        locationsByParent.set(key, []);
      }
      locationsByParent.get(key)!.push(location);
    }

    let updatedCount = 0;
    let errorCount = 0;

    // Process each group
    for (const [key, locations] of locationsByParent) {
      try {
        // Sort by creation time
        const sortedLocations = locations.sort(
          (a, b) => a._creationTime - b._creationTime,
        );

        // Assign sortOrder
        for (let i = 0; i < sortedLocations.length; i++) {
          const location = sortedLocations[i];
          if (location) {
            await ctx.db.patch(location._id, {
              sortOrder: i,
            });
            updatedCount++;
          }
        }

        console.log(`✓ Updated ${locations.length} locations in group ${key}`);
      } catch (error) {
        console.error(`Error processing group ${key}:`, error);
        errorCount++;
      }
    }

    const result = {
      success: true,
      message: `Migration complete: ${updatedCount} locations updated, ${errorCount} errors`,
      stats: {
        totalLocations: allLocations.length,
        updated: updatedCount,
        errors: errorCount,
        groups: locationsByParent.size,
      },
    };

    console.log(result.message);
    return result;
  },
});

export const backfillAccountType = internalMutation({
  handler: async (ctx) => {
    console.log("Starting migration: Backfill accountType for accounts");

    const allAccounts = await ctx.db.query("accounts").collect();
    console.log(`Found ${allAccounts.length} total accounts`);

    const accountsWithoutType = allAccounts.filter(
      (a) => a.accountType === undefined || a.accountType === null,
    );
    console.log(
      `Found ${accountsWithoutType.length} accounts without accountType`,
    );

    let updatedCount = 0;
    let errorCount = 0;

    for (const account of accountsWithoutType) {
      try {
        await ctx.db.patch(account._id, {
          accountType: "institution",
        });

        updatedCount++;

        if (updatedCount % 100 === 0) {
          console.log(`Progress: ${updatedCount} accounts updated...`);
        }
      } catch (error) {
        console.error(`Error updating account ${account._id}:`, error);
        errorCount++;
      }
    }

    const result = {
      success: true,
      message: `Migration complete: ${updatedCount} accounts updated, ${errorCount} errors`,
      stats: {
        totalAccounts: allAccounts.length,
        withoutType: accountsWithoutType.length,
        updated: updatedCount,
        errors: errorCount,
      },
    };

    console.log(result.message);
    return result;
  },
});

/**
 * Migration: Add default workflow configurations to existing organizations
 *
 * This migration adds default deaccession and accession workflow configurations
 * to organizations that don't have them yet. This ensures that all organizations
 * require administrator approval for deaccessions and accessions.
 *
 * Run this migration via Convex dashboard or CLI:
 * npx convex run migrations:addDefaultWorkflowsToOrgs
 */
export const addDefaultWorkflowsToOrgs = internalMutation({
  handler: async (ctx) => {
    console.log("Starting migration: Add default workflows to organizations");

    const organizations = await ctx.db.query("organizations").collect();
    console.log(`Found ${organizations.length} organizations`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const org of organizations) {
      try {
        // Check if workflows already exist
        const existingWorkflows = await ctx.db
          .query("workflowConfigs")
          .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
          .collect();

        if (existingWorkflows.length > 0) {
          console.log(`Skipping ${org.name} - workflows already exist`);
          skippedCount++;
          continue;
        }

        // Find admin role for this organization
        const adminRole = await ctx.db
          .query("roles")
          .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
          .filter((q) =>
            q.and(
              q.eq(q.field("name"), "admin"),
              q.eq(q.field("isSystemRole"), true),
            ),
          )
          .first();

        if (!adminRole) {
          console.warn(`No admin role found for ${org.name}`);
          errorCount++;
          continue;
        }

        const workflowTypes = [
          "accession",
          "deaccession",
          "loan",
          "acquisition",
          "exhibition",
          "conservation",
        ] as const;

        for (const workflowType of workflowTypes) {
          await ctx.db.insert("workflowConfigs", {
            organizationId: org._id,
            workflowType,
            steps: [
              {
                stepNumber: 1,
                roleId: adminRole._id,
                name: "Administrator Approval",
              },
            ],
            canInitiateRoles: [adminRole._id],
          });
        }

        console.log(`✓ Added default workflows for ${org.name}`);
        updatedCount++;
      } catch (error) {
        console.error(`Error processing ${org.name}:`, error);
        errorCount++;
      }
    }

    const result = {
      success: true,
      message: `Migration complete: ${updatedCount} updated, ${skippedCount} skipped, ${errorCount} errors`,
      stats: {
        totalOrganizations: organizations.length,
        updated: updatedCount,
        skipped: skippedCount,
        errors: errorCount,
      },
    };

    console.log(result.message);
    return result;
  },
});

/**
 * Migration: Backfill mediaCategory field for existing media files
 *
 * This migration adds the mediaCategory field to all existing media files
 * that don't have it set. The category is determined based on the fileType:
 * - "image" or "video" -> mediaCategory: "image"
 * - "document" -> mediaCategory: "document"
 * - Other types default to "image" for backwards compatibility
 *
 * Run this migration via Convex dashboard or CLI:
 * npx convex run migrations:backfillMediaCategory
 */
export const backfillMediaCategory = internalMutation({
  handler: async (ctx) => {
    console.log("Starting migration: Backfill mediaCategory for media files");

    // Get all media files
    const allMedia = await ctx.db.query("mediaFiles").collect();
    console.log(`Found ${allMedia.length} total media files`);

    const mediaWithoutCategory = allMedia.filter(
      (m) => m.mediaCategory === undefined || m.mediaCategory === null,
    );
    console.log(
      `Found ${mediaWithoutCategory.length} media files without mediaCategory`,
    );

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Document mime types that should be categorized as "document"
    const documentMimeTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    for (const media of mediaWithoutCategory) {
      try {
        let mediaCategory: "image" | "document";

        // Determine category based on fileType
        if (media.fileType === "document") {
          mediaCategory = "document";
        } else if (media.fileType === "image" || media.fileType === "video") {
          mediaCategory = "image";
        } else {
          // For other types (3d, other), check mimeType to determine category
          if (documentMimeTypes.includes(media.mimeType)) {
            mediaCategory = "document";
          } else {
            // Default to "image" for backwards compatibility
            mediaCategory = "image";
          }
        }

        await ctx.db.patch(media._id, {
          mediaCategory,
        });

        updatedCount++;

        if (updatedCount % 100 === 0) {
          console.log(`Progress: ${updatedCount} files updated...`);
        }
      } catch (error) {
        console.error(`Error updating media ${media._id}:`, error);
        errorCount++;
      }
    }

    // Also validate and fix files that might have incorrect category
    const mediaWithCategory = allMedia.filter(
      (m) => m.mediaCategory !== undefined && m.mediaCategory !== null,
    );

    for (const media of mediaWithCategory) {
      try {
        // Check if the category matches the fileType/mimeType
        const shouldBeDocument =
          media.fileType === "document" ||
          documentMimeTypes.includes(media.mimeType);

        const shouldBeImage =
          media.fileType === "image" || media.fileType === "video";

        // Only update if there's a mismatch
        if (shouldBeDocument && media.mediaCategory !== "document") {
          await ctx.db.patch(media._id, {
            mediaCategory: "document",
          });
          updatedCount++;
        } else if (shouldBeImage && media.mediaCategory !== "image") {
          await ctx.db.patch(media._id, {
            mediaCategory: "image",
          });
          updatedCount++;
        } else {
          skippedCount++;
        }
      } catch (error) {
        console.error(`Error validating media ${media._id}:`, error);
        errorCount++;
      }
    }

    const result = {
      success: true,
      message: `Migration complete: ${updatedCount} files updated, ${skippedCount} skipped, ${errorCount} errors`,
      stats: {
        totalMedia: allMedia.length,
        withoutCategory: mediaWithoutCategory.length,
        updated: updatedCount,
        skipped: skippedCount,
        errors: errorCount,
      },
    };

    console.log(result.message);
    return result;
  },
});

/**
 * Migration: Add accounts permissions for existing organizations
 *
 * Creates accounts.read, accounts.write, accounts.manage, accounts.delete permissions
 * and assigns them to admin roles for all existing organizations.
 *
 * Run: npx convex run migrations:addAccountsPermissions
 */
export const addAccountsPermissions = internalMutation({
  args: {},
  returns: v.object({
    created: v.number(),
    assigned: v.number(),
  }),
  handler: async (ctx) => {
    console.log("Starting migration: Add accounts permissions");

    const accountsPermissions = [
      { name: "accounts.read", description: "View accounts and contacts" },
      {
        name: "accounts.write",
        description: "Create and edit accounts and contacts",
      },
      {
        name: "accounts.manage",
        description: "Manage account relationships and segments",
      },
      { name: "accounts.delete", description: "Delete accounts and contacts" },
    ];

    const permissionIds: Id<"permissions">[] = [];
    let created = 0;

    for (const perm of accountsPermissions) {
      const existing = await ctx.db
        .query("permissions")
        .withIndex("by_category", (q) => q.eq("category", "accounts"))
        .filter((q) => q.eq(q.field("name"), perm.name))
        .first();

      if (existing) {
        permissionIds.push(existing._id);
      } else {
        const id = await ctx.db.insert("permissions", {
          name: perm.name,
          description: perm.description,
          category: "accounts",
        });
        permissionIds.push(id);
        created++;
      }
    }

    // Assign all accounts permissions to admin roles
    const adminRoles = await ctx.db
      .query("roles")
      .filter((q) => q.eq(q.field("name"), "admin"))
      .collect();

    let assigned = 0;
    for (const role of adminRoles) {
      for (const permId of permissionIds) {
        const existing = await ctx.db
          .query("rolePermissions")
          .withIndex("by_role", (q) => q.eq("roleId", role._id))
          .filter((q) => q.eq(q.field("permissionId"), permId))
          .first();

        if (!existing) {
          await ctx.db.insert("rolePermissions", {
            roleId: role._id,
            permissionId: permId,
          });
          assigned++;
        }
      }
    }

    console.log(
      `Created ${created} permissions, assigned ${assigned} role-permissions`,
    );
    return { created, assigned };
  },
});

/**
 * Migration: Add loans admin permissions for existing organizations
 *
 * Creates loans.view_admin_overview, loans.view_transport permissions
 * and adds organization.view_analytics to registrar role.
 * Assigns all three permissions to admin and registrar roles.
 *
 * Run: npx convex run migrations:backfillLoanAdminPermissions
 */
export const backfillLoanAdminPermissions = internalMutation({
  args: {},
  returns: v.object({
    permissionsCreated: v.number(),
    rolePermissionsAdded: v.number(),
  }),
  handler: async (ctx) => {
    console.log("Starting migration: Add loans admin permissions");

    const newPermissions = [
      {
        name: "loans.view_admin_overview",
        description: "View loans admin overview and KPIs",
        category: "loans" as const,
      },
      {
        name: "loans.view_transport",
        description: "View loan transport status",
        category: "loans" as const,
      },
    ];

    const permissionIds: Map<string, Id<"permissions">> = new Map();
    let permissionsCreated = 0;

    for (const perm of newPermissions) {
      const existing = await ctx.db
        .query("permissions")
        .withIndex("by_category", (q) => q.eq("category", perm.category))
        .filter((q) => q.eq(q.field("name"), perm.name))
        .first();

      if (existing) {
        permissionIds.set(perm.name, existing._id);
        console.log(`Permission ${perm.name} already exists`);
      } else {
        const id = await ctx.db.insert("permissions", {
          name: perm.name,
          description: perm.description,
          category: perm.category,
        });
        permissionIds.set(perm.name, id);
        permissionsCreated++;
        console.log(`Created permission ${perm.name}`);
      }
    }

    const analyticsPermission = await ctx.db
      .query("permissions")
      .withIndex("by_category", (q) => q.eq("category", "organization"))
      .filter((q) => q.eq(q.field("name"), "organization.view_analytics"))
      .first();

    if (analyticsPermission) {
      permissionIds.set("organization.view_analytics", analyticsPermission._id);
    }

    const organizations = await ctx.db.query("organizations").collect();
    console.log(`Found ${organizations.length} organizations`);

    let rolePermissionsAdded = 0;

    for (const org of organizations) {
      const adminRole = await ctx.db
        .query("roles")
        .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
        .filter((q) =>
          q.and(
            q.eq(q.field("name"), "admin"),
            q.eq(q.field("isSystemRole"), true),
          ),
        )
        .first();

      const registrarRole = await ctx.db
        .query("roles")
        .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
        .filter((q) =>
          q.and(
            q.eq(q.field("name"), "registrar"),
            q.eq(q.field("isSystemRole"), true),
          ),
        )
        .first();

      const rolesToUpdate = [
        { role: adminRole, name: "admin" },
        { role: registrarRole, name: "registrar" },
      ];

      for (const { role, name } of rolesToUpdate) {
        if (!role) {
          console.warn(`No ${name} role found for organization ${org.name}`);
          continue;
        }

        for (const [permName, permId] of permissionIds) {
          const existing = await ctx.db
            .query("rolePermissions")
            .withIndex("by_role", (q) => q.eq("roleId", role._id))
            .filter((q) => q.eq(q.field("permissionId"), permId))
            .first();

          if (!existing) {
            await ctx.db.insert("rolePermissions", {
              roleId: role._id,
              permissionId: permId,
            });
            rolePermissionsAdded++;
            console.log(`Added ${permName} to ${name} role for ${org.name}`);
          }
        }
      }
    }

    console.log(
      `Created ${permissionsCreated} permissions, added ${rolePermissionsAdded} role-permissions`,
    );

    return {
      permissionsCreated,
      rolePermissionsAdded,
    };
  },
});
