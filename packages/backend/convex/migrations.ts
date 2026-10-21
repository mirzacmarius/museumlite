import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { upsertAccessionSearchDocument } from "./utils/accessionSearch";
import { processOptionUsageBackfillPage } from "./utils/collectionOptionUsages";
import {
  assignCustomerNumberIfMissing,
  parseCustomerNumber,
} from "./utils/customerNumber";
import { normalizeIdentifier } from "./utils/identifiers";
import { COORDINATE_PERMISSION } from "./utils/incidentAccess";
import { internalMutation } from "./utils/mutationBuilders";
import { patchOrganizationTransferFieldsIfMissing } from "./utils/organizationTransferRegistry";
import { keepOldestPrimaryImage } from "./utils/primaryMedia";
import { rehomeObjectProvenance } from "./utils/provenance";
import { syncPublicRendition } from "./utils/publicMedia";
import { SUPER_ADMIN_ROLE_NAME } from "./utils/superAdmins";
import {
  grantPermissionToSystemRoles,
  REVIEWER_SYSTEM_ROLE_NAMES,
  VALUATION_SYSTEM_ROLE_NAMES,
} from "./utils/systemRoleGrants";
import {
  COLLECTION_MANAGER_ROLE_DESCRIPTION,
  COLLECTION_MANAGER_ROLE_NAME,
  findCollectionManagerRole,
  LEGACY_REGISTRAR_ROLE_NAME,
  SYSTEM_ROLE_DEFINITIONS,
} from "./utils/systemRoles";
import { VALUATION_PERMISSION } from "./utils/valuation";

function getLocationCodePrefix(type: string) {
  switch (type.trim().toLowerCase()) {
    case "building":
      return "B";
    case "room":
      return "R";
    case "gallery":
      return "G";
    case "storage":
      return "ST";
    case "cabinet":
      return "C";
    case "shelf":
      return "SH";
    case "vault":
      return "V";
    default:
      return "L";
  }
}

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
    await Promise.all(
      Array.from(locationsByParent).map(async ([key, locations]) => {
        try {
          // Sort by creation time
          const sortedLocations = locations.sort(
            (a, b) => a._creationTime - b._creationTime,
          );

          // Assign sortOrder
          await Promise.all(
            Array.from({ length: sortedLocations.length }, async (_, i) => {
              const location = sortedLocations[i];
              if (location) {
                await ctx.db.patch(location._id, {
                  sortOrder: i,
                });
                updatedCount++;
              }
            }),
          );

          console.log(
            `✓ Updated ${locations.length} locations in group ${key}`,
          );
        } catch (error) {
          console.error(`Error processing group ${key}:`, error);
          errorCount++;
        }
      }),
    );

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

    await Promise.all(
      Array.from(accountsWithoutType).map(async (account) => {
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
      }),
    );

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

export const backfillLocationCodes = internalMutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    stats: v.object({
      totalLocations: v.number(),
      updated: v.number(),
      errors: v.number(),
      groups: v.number(),
    }),
  }),
  handler: async (ctx) => {
    console.log("Starting migration: Backfill locationCode for locations");

    const allLocations = await ctx.db.query("locations").collect();
    console.log(`Found ${allLocations.length} locations`);

    const locationsByParent = new Map<string, typeof allLocations>();

    for (const location of allLocations) {
      const key = `${location.organizationId}:${location.parentLocationId ?? "root"}`;
      const existingLocations = locationsByParent.get(key);
      if (existingLocations) {
        existingLocations.push(location);
      } else {
        locationsByParent.set(key, [location]);
      }
    }

    const groupResults = await Promise.all(
      [...locationsByParent.entries()].map(async ([key, locations]) => {
        try {
          const sortedLocations = locations.toSorted((left, right) => {
            if (left.sortOrder !== right.sortOrder) {
              return left.sortOrder - right.sortOrder;
            }

            return left._creationTime - right._creationTime;
          });

          const locationPatches = sortedLocations.flatMap((location, i) => {
            if (!location || location.locationCode) {
              return [];
            }

            const prefix = getLocationCodePrefix(location.type);
            const sequence = String(i + 1).padStart(3, "0");
            const locationCode = `${prefix}-${sequence}`;

            return [
              ctx.db.patch(location._id, {
                locationCode,
                locationCodeNormalized: locationCode.toLowerCase(),
              }),
            ];
          });

          await Promise.all(locationPatches);

          console.log(
            `✓ Updated ${locations.length} locations in group ${key}`,
          );
          return { updated: locationPatches.length, error: false };
        } catch (error) {
          console.error(`Error processing group ${key}:`, error);
          return { updated: 0, error: true };
        }
      }),
    );

    const updatedCount = groupResults.reduce(
      (sum, result) => sum + result.updated,
      0,
    );
    const errorCount = groupResults.filter((result) => result.error).length;

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

    await Promise.all(
      Array.from(organizations).map(async (org) => {
        try {
          // Check if workflows already exist
          const existingWorkflows = await ctx.db
            .query("workflowConfigs")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", org._id),
            )
            .collect();

          if (existingWorkflows.length > 0) {
            console.log(`Skipping ${org.name} - workflows already exist`);
            skippedCount++;
            return;
          }

          // Find admin role for this organization
          const adminRole = await ctx.db
            .query("roles")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", org._id),
            )
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
            return;
          }

          const workflowTypes = [
            "accession",
            "deaccession",
            "loan",
            "acquisition",
            "exhibition",
            "conservation",
          ] as const;

          await Promise.all(
            Array.from(workflowTypes).map(async (workflowType) => {
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
            }),
          );

          console.log(`✓ Added default workflows for ${org.name}`);
          updatedCount++;
        } catch (error) {
          console.error(`Error processing ${org.name}:`, error);
          errorCount++;
        }
      }),
    );

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

    await Promise.all(
      Array.from(mediaWithoutCategory).map(async (media) => {
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
      }),
    );

    // Also validate and fix files that might have incorrect category
    const mediaWithCategory = allMedia.filter(
      (m) => m.mediaCategory !== undefined && m.mediaCategory !== null,
    );

    await Promise.all(
      Array.from(mediaWithCategory).map(async (media) => {
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
      }),
    );

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

    await Promise.all(
      Array.from(accountsPermissions).map(async (perm) => {
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
      }),
    );

    // Assign all accounts permissions to admin roles
    const adminRoles = await ctx.db
      .query("roles")
      .filter((q) => q.eq(q.field("name"), "admin"))
      .collect();

    let assigned = 0;
    await Promise.all(
      Array.from(adminRoles).map(async (role) => {
        await Promise.all(
          Array.from(permissionIds).map(async (permId) => {
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
          }),
        );
      }),
    );

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

    await Promise.all(
      Array.from(newPermissions).map(async (perm) => {
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
      }),
    );

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

    await Promise.all(
      Array.from(organizations).map(async (org) => {
        const [adminRole, collectionManagerRole] = await Promise.all([
          ctx.db
            .query("roles")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", org._id),
            )
            .filter((q) =>
              q.and(
                q.eq(q.field("name"), "admin"),
                q.eq(q.field("isSystemRole"), true),
              ),
            )
            .first(),
          findCollectionManagerRole(ctx, org._id),
        ]);

        const rolesToUpdate = [
          { role: adminRole, name: "admin" },
          {
            role: collectionManagerRole,
            name: collectionManagerRole?.name ?? COLLECTION_MANAGER_ROLE_NAME,
          },
        ];

        await Promise.all(
          rolesToUpdate.map(async ({ role, name }) => {
            if (!role) {
              console.warn(
                `No ${name} role found for organization ${org.name}`,
              );
              return;
            }

            await Promise.all(
              Array.from(permissionIds).map(async ([permName, permId]) => {
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
                  console.log(
                    `Added ${permName} to ${name} role for ${org.name}`,
                  );
                }
              }),
            );
          }),
        );
      }),
    );

    console.log(
      `Created ${permissionsCreated} permissions, added ${rolePermissionsAdded} role-permissions`,
    );

    return {
      permissionsCreated,
      rolePermissionsAdded,
    };
  },
});

export const addSitesPermissions = internalMutation({
  args: {},
  returns: v.object({
    permissionsCreated: v.number(),
    rolePermissionsAdded: v.number(),
  }),
  handler: async (ctx) => {
    console.log("Starting migration: Add sites permissions");

    const sitesPermissions = [
      { name: "sites.create", description: "Create new sites" },
      { name: "sites.read", description: "View sites" },
      { name: "sites.update", description: "Edit sites" },
      { name: "sites.delete", description: "Delete sites" },
    ];

    const permissionIds: Map<string, Id<"permissions">> = new Map();
    let permissionsCreated = 0;

    await Promise.all(
      Array.from(sitesPermissions).map(async (perm) => {
        const existing = await ctx.db
          .query("permissions")
          .withIndex("by_category", (q) => q.eq("category", "sites"))
          .filter((q) => q.eq(q.field("name"), perm.name))
          .first();

        if (existing) {
          permissionIds.set(perm.name, existing._id);
          console.log(`Permission ${perm.name} already exists`);
        } else {
          const id = await ctx.db.insert("permissions", {
            name: perm.name,
            description: perm.description,
            category: "sites",
          });
          permissionIds.set(perm.name, id);
          permissionsCreated++;
          console.log(`Created permission ${perm.name}`);
        }
      }),
    );

    const organizations = await ctx.db.query("organizations").collect();
    console.log(`Found ${organizations.length} organizations`);

    let rolePermissionsAdded = 0;

    await Promise.all(
      Array.from(organizations).map(async (org) => {
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

        if (adminRole) {
          await Promise.all(
            Array.from(permissionIds).map(async ([permName, permId]) => {
              const existing = await ctx.db
                .query("rolePermissions")
                .withIndex("by_role", (q) => q.eq("roleId", adminRole._id))
                .filter((q) => q.eq(q.field("permissionId"), permId))
                .first();

              if (!existing) {
                await ctx.db.insert("rolePermissions", {
                  roleId: adminRole._id,
                  permissionId: permId,
                });
                rolePermissionsAdded++;
                console.log(`Added ${permName} to admin role for ${org.name}`);
              }
            }),
          );
        }

        const readOnlyRoles = [
          "curator",
          LEGACY_REGISTRAR_ROLE_NAME,
          COLLECTION_MANAGER_ROLE_NAME,
          "cataloger",
          "viewer",
        ];
        const sitesReadPermId = permissionIds.get("sites.read");

        if (sitesReadPermId) {
          await Promise.all(
            Array.from(readOnlyRoles).map(async (roleName) => {
              const role = await ctx.db
                .query("roles")
                .withIndex("by_organization", (q) =>
                  q.eq("organizationId", org._id),
                )
                .filter((q) =>
                  q.and(
                    q.eq(q.field("name"), roleName),
                    q.eq(q.field("isSystemRole"), true),
                  ),
                )
                .first();

              if (role) {
                const existing = await ctx.db
                  .query("rolePermissions")
                  .withIndex("by_role", (q) => q.eq("roleId", role._id))
                  .filter((q) => q.eq(q.field("permissionId"), sitesReadPermId))
                  .first();

                if (!existing) {
                  await ctx.db.insert("rolePermissions", {
                    roleId: role._id,
                    permissionId: sitesReadPermId,
                  });
                  rolePermissionsAdded++;
                  console.log(
                    `Added sites.read to ${roleName} role for ${org.name}`,
                  );
                }
              }
            }),
          );
        }
      }),
    );

    console.log(
      `Created ${permissionsCreated} permissions, added ${rolePermissionsAdded} role-permissions`,
    );

    return {
      permissionsCreated,
      rolePermissionsAdded,
    };
  },
});

/**
 * Migration: Add collection workflow approval permissions for existing organizations
 *
 * Creates:
 * - collections.approve_acquisition
 * - collections.approve_exhibition
 * - collections.approve_conservation
 *
 * Assigns:
 * - admin: all three permissions
 * - curator: collections.approve_conservation
 *
 * Run: npx convex run migrations:addCollectionWorkflowApprovalPermissions
 */
export const addCollectionWorkflowApprovalPermissions = internalMutation({
  args: {},
  returns: v.object({
    permissionsCreated: v.number(),
    rolePermissionsAdded: v.number(),
  }),
  handler: async (ctx) => {
    console.log(
      "Starting migration: Add collection workflow approval permissions",
    );

    const approvalPermissions = [
      {
        name: "collections.approve_acquisition",
        description: "Approve acquisition workflows",
      },
      {
        name: "collections.approve_exhibition",
        description: "Approve exhibition workflows",
      },
      {
        name: "collections.approve_conservation",
        description: "Approve conservation workflows",
      },
    ];

    const permissionIds = new Map<string, Id<"permissions">>();
    let permissionsCreated = 0;

    await Promise.all(
      Array.from(approvalPermissions).map(async (perm) => {
        const existing = await ctx.db
          .query("permissions")
          .withIndex("by_category", (q) => q.eq("category", "collections"))
          .filter((q) => q.eq(q.field("name"), perm.name))
          .first();

        if (existing) {
          permissionIds.set(perm.name, existing._id);
        } else {
          const id = await ctx.db.insert("permissions", {
            name: perm.name,
            description: perm.description,
            category: "collections",
          });
          permissionIds.set(perm.name, id);
          permissionsCreated++;
        }
      }),
    );

    let rolePermissionsAdded = 0;
    const organizations = await ctx.db.query("organizations").collect();

    await Promise.all(
      Array.from(organizations).map(async (organization) => {
        const roles = await ctx.db
          .query("roles")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organization._id),
          )
          .collect();

        const adminRole = roles.find(
          (role) => role.isSystemRole && role.name === "admin",
        );
        const curatorRole = roles.find(
          (role) => role.isSystemRole && role.name === "curator",
        );

        const assignments = [
          {
            role: adminRole,
            permissionNames: [
              "collections.approve_acquisition",
              "collections.approve_exhibition",
              "collections.approve_conservation",
            ],
          },
          {
            role: curatorRole,
            permissionNames: ["collections.approve_conservation"],
          },
        ];

        await Promise.all(
          assignments.map(async (assignment) => {
            const role = assignment.role;
            if (!role) {
              return;
            }

            await Promise.all(
              assignment.permissionNames.map(async (permissionName) => {
                const permissionId = permissionIds.get(permissionName);
                if (!permissionId) {
                  return;
                }

                const existing = await ctx.db
                  .query("rolePermissions")
                  .withIndex("by_role", (q) => q.eq("roleId", role._id))
                  .filter((q) => q.eq(q.field("permissionId"), permissionId))
                  .first();

                if (!existing) {
                  await ctx.db.insert("rolePermissions", {
                    roleId: role._id,
                    permissionId,
                  });
                  rolePermissionsAdded++;
                }
              }),
            );
          }),
        );
      }),
    );

    console.log(
      `Created ${permissionsCreated} permissions, added ${rolePermissionsAdded} role-permissions`,
    );

    return {
      permissionsCreated,
      rolePermissionsAdded,
    };
  },
});

/**
 * Migration: Backfill organization registry account numbers (ORG-#####) and
 * denormalized allowsIncomingTransferRequests for existing organizations.
 *
 * Run: bunx convex run migrations:backfillOrganizationTransferFields
 */
export const backfillOrganizationTransferFields = internalMutation({
  args: {},
  returns: v.object({
    totalOrganizations: v.number(),
    accountNumbersAssigned: v.number(),
    transferFlagsSynced: v.number(),
  }),
  handler: async (ctx) => {
    console.log(
      "Starting migration: Backfill organization transfer registry fields",
    );

    const organizations = await ctx.db.query("organizations").collect();
    const sortedOrganizations = organizations.sort(
      (a, b) => a._creationTime - b._creationTime,
    );

    let accountNumbersAssigned = 0;
    let transferFlagsSynced = 0;

    for (let index = 0; index < sortedOrganizations.length; index++) {
      const organization = sortedOrganizations[index];
      if (!organization) {
        continue;
      }

      const hadAccountNumber = Boolean(organization.accountNumber);
      const hadTransferFlag =
        organization.allowsIncomingTransferRequests !== undefined;

      const accountNumber = await patchOrganizationTransferFieldsIfMissing(
        ctx,
        organization,
      );

      if (!hadAccountNumber && accountNumber) {
        accountNumbersAssigned++;
      }
      if (!hadTransferFlag) {
        transferFlagsSynced++;
      }
    }

    const result = {
      totalOrganizations: sortedOrganizations.length,
      accountNumbersAssigned,
      transferFlagsSynced,
    };

    console.log(
      `Migration complete: ${result.accountNumbersAssigned} account numbers assigned, ${result.transferFlagsSynced} transfer flags synced (${result.totalOrganizations} organizations)`,
    );

    return result;
  },
});

/**
 * Run: bunx convex run migrations:backfillCustomerNumbers
 */
export const backfillCustomerNumbers = internalMutation({
  args: {},
  returns: v.object({
    totalOrganizations: v.number(),
    customerNumbersAssigned: v.number(),
    alreadyAssigned: v.number(),
  }),
  handler: async (ctx) => {
    console.log("Starting migration: Backfill organization customer numbers");

    const organizations = await ctx.db.query("organizations").collect();
    const sortedOrganizations = organizations.sort(
      (a, b) => a._creationTime - b._creationTime,
    );

    let customerNumbersAssigned = 0;
    let alreadyAssigned = 0;

    for (const organization of sortedOrganizations) {
      const hadValidCustomerNumber = Boolean(
        organization.customerNumber &&
          parseCustomerNumber(organization.customerNumber),
      );

      await assignCustomerNumberIfMissing(ctx, organization);

      if (hadValidCustomerNumber) {
        alreadyAssigned++;
      } else {
        customerNumbersAssigned++;
      }
    }

    const result = {
      totalOrganizations: sortedOrganizations.length,
      customerNumbersAssigned,
      alreadyAssigned,
    };

    console.log(
      `Migration complete: ${result.customerNumbersAssigned} customer numbers assigned, ${result.alreadyAssigned} already assigned (${result.totalOrganizations} organizations)`,
    );

    return result;
  },
});

/**
 * Migration: Backfill super_admin system role and assign owners as SuperAdmins.
 *
 * Run: bunx convex run migrations:backfillSuperAdminRoles
 */
export const backfillSuperAdminRoles = internalMutation({
  args: {},
  returns: v.object({
    totalOrganizations: v.number(),
    rolesCreated: v.number(),
    membershipsUpdated: v.number(),
  }),
  handler: async (ctx) => {
    console.log("Starting migration: Backfill super_admin roles");

    const organizations = await ctx.db.query("organizations").collect();
    let rolesCreated = 0;
    let membershipsUpdated = 0;

    for (const organization of organizations) {
      const { db } = ctx;
      const rolesQuery = db.query("roles");
      const rolePermissionsQuery = db.query("rolePermissions");
      const userOrganizationsQuery = db.query("userOrganizations");
      let superAdminRole = await rolesQuery
        .withIndex("by_organization_and_name", (q) =>
          q
            .eq("organizationId", organization._id)
            .eq("name", SUPER_ADMIN_ROLE_NAME),
        )
        .first();
      if (!superAdminRole) {
        const adminRole = await rolesQuery
          .withIndex("by_organization_and_name", (q) =>
            q.eq("organizationId", organization._id).eq("name", "admin"),
          )
          .first();

        const superAdminRoleId = await db.insert("roles", {
          organizationId: organization._id,
          name: SUPER_ADMIN_ROLE_NAME,
          description: "Owner with full organization control (SuperAdmin)",
          isSystemRole: true,
        });
        superAdminRole = await db.get(superAdminRoleId);
        rolesCreated += 1;

        if (adminRole) {
          const adminPermissions = await rolePermissionsQuery
            .withIndex("by_role", (q) => q.eq("roleId", adminRole._id))
            .collect();

          for (const rolePermission of adminPermissions) {
            await db.insert("rolePermissions", {
              roleId: superAdminRoleId,
              permissionId: rolePermission.permissionId,
            });
          }
        }
      }

      if (!superAdminRole) {
        continue;
      }

      if (organization.ownerUserId) {
        const ownerMembership = await userOrganizationsQuery
          .withIndex("by_user_and_organization", (q) =>
            q
              .eq("userId", organization.ownerUserId!)
              .eq("organizationId", organization._id),
          )
          .first();

        if (ownerMembership && ownerMembership.roleId !== superAdminRole._id) {
          await db.patch(ownerMembership._id, {
            roleId: superAdminRole._id,
          });
          membershipsUpdated += 1;
        } else if (!ownerMembership) {
          await db.insert("userOrganizations", {
            userId: organization.ownerUserId,
            organizationId: organization._id,
            roleId: superAdminRole._id,
            joinedAt: Date.now(),
          });
          membershipsUpdated += 1;
        }
      }
    }

    const result = {
      totalOrganizations: organizations.length,
      rolesCreated,
      membershipsUpdated,
    };

    console.log(
      `Migration complete: ${result.rolesCreated} super_admin roles created, ${result.membershipsUpdated} memberships updated`,
    );

    return result;
  },
});

export const backfillCollectionOptionUsages = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.object({
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ isDone: boolean; continueCursor: string | null }> => {
    const result = await processOptionUsageBackfillPage(ctx, args);
    if (!result.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.backfillCollectionOptionUsages,
        {
          organizationId: args.organizationId,
          cursor: result.continueCursor,
        },
      );
    }

    return result;
  },
});

/**
 * Migration: Rename the system registrar role to Collection Manager.
 *
 * Patches the existing role document so memberships and permissions stay attached.
 * Run: bunx convex run migrations:renameRegistrarToCollectionManager
 */
export const renameRegistrarToCollectionManager = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({
    organizationsScanned: v.number(),
    renamed: v.number(),
    descriptionsUpdated: v.number(),
    skippedNameConflicts: v.number(),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    organizationsScanned: number;
    renamed: number;
    descriptionsUpdated: number;
    skippedNameConflicts: number;
    isDone: boolean;
    continueCursor: string | null;
  }> => {
    const organizationsPage = await ctx.db.query("organizations").paginate({
      numItems: 100,
      cursor: args.cursor ?? null,
    });
    let renamed = 0;
    let descriptionsUpdated = 0;
    let skippedNameConflicts = 0;

    for (const organization of organizationsPage.page) {
      const legacyRole = await ctx.db
        .query("roles")
        .withIndex("by_organization_and_name", (q) =>
          q
            .eq("organizationId", organization._id)
            .eq("name", LEGACY_REGISTRAR_ROLE_NAME),
        )
        .first();
      const currentRole = await ctx.db
        .query("roles")
        .withIndex("by_organization_and_name", (q) =>
          q
            .eq("organizationId", organization._id)
            .eq("name", COLLECTION_MANAGER_ROLE_NAME),
        )
        .first();

      if (legacyRole?.isSystemRole) {
        if (currentRole && currentRole._id !== legacyRole._id) {
          skippedNameConflicts += 1;
          continue;
        }

        const descriptionChanged =
          legacyRole.description !== COLLECTION_MANAGER_ROLE_DESCRIPTION;
        await ctx.db.patch(legacyRole._id, {
          name: COLLECTION_MANAGER_ROLE_NAME,
          description: COLLECTION_MANAGER_ROLE_DESCRIPTION,
        });
        renamed += 1;
        if (descriptionChanged) {
          descriptionsUpdated += 1;
        }
        continue;
      }

      if (
        currentRole?.isSystemRole &&
        currentRole.description !== COLLECTION_MANAGER_ROLE_DESCRIPTION
      ) {
        await ctx.db.patch(currentRole._id, {
          description: COLLECTION_MANAGER_ROLE_DESCRIPTION,
        });
        descriptionsUpdated += 1;
      }
    }

    console.log(
      `Renamed ${renamed} registrar roles to ${COLLECTION_MANAGER_ROLE_NAME}, updated ${descriptionsUpdated} descriptions, skipped ${skippedNameConflicts} name conflicts`,
    );

    if (!organizationsPage.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.renameRegistrarToCollectionManager,
        { cursor: organizationsPage.continueCursor },
      );
    }

    return {
      organizationsScanned: organizationsPage.page.length,
      renamed,
      descriptionsUpdated,
      skippedNameConflicts,
      isDone: organizationsPage.isDone,
      continueCursor: organizationsPage.isDone
        ? null
        : organizationsPage.continueCursor,
    };
  },
});

/**
 * Migration: Refresh the descriptions for every visible system role.
 *
 * The role names used as internal identifiers remain unchanged. The API maps
 * those identifiers to their user-facing names through getRolePresentation.
 * Run: bunx convex run migrations:refreshSystemRoleDescriptions '{}'
 */
export const refreshSystemRoleDescriptions = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({
    organizationsScanned: v.number(),
    rolesMatched: v.number(),
    descriptionsUpdated: v.number(),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    organizationsScanned: number;
    rolesMatched: number;
    descriptionsUpdated: number;
    isDone: boolean;
    continueCursor: string | null;
  }> => {
    const organizationsPage = await ctx.db.query("organizations").paginate({
      numItems: 100,
      cursor: args.cursor ?? null,
    });
    let rolesMatched = 0;
    let descriptionsUpdated = 0;

    for (const organization of organizationsPage.page) {
      for (const definition of SYSTEM_ROLE_DEFINITIONS) {
        for (const roleName of definition.recognizedNames) {
          const role = await ctx.db
            .query("roles")
            .withIndex("by_organization_and_name", (q) =>
              q.eq("organizationId", organization._id).eq("name", roleName),
            )
            .first();

          if (!role?.isSystemRole) {
            continue;
          }

          rolesMatched += 1;
          if (role.description !== definition.description) {
            await ctx.db.patch(role._id, {
              description: definition.description,
            });
            descriptionsUpdated += 1;
          }
        }
      }
    }

    if (!organizationsPage.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.refreshSystemRoleDescriptions,
        { cursor: organizationsPage.continueCursor },
      );
    }

    return {
      organizationsScanned: organizationsPage.page.length,
      rolesMatched,
      descriptionsUpdated,
      isDone: organizationsPage.isDone,
      continueCursor: organizationsPage.isDone
        ? null
        : organizationsPage.continueCursor,
    };
  },
});

/**
 * Grant media upload to existing system Collection Manager roles. Object drafts
 * upload selected media before saving or submitting their accession request.
 * Run once: bunx convex run migrations:grantCollectionManagerMediaUpload '{}'
 * Remaining organization pages are scheduled automatically.
 */
export const grantCollectionManagerMediaUpload = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({
    organizationsScanned: v.number(),
    rolePermissionsAdded: v.number(),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const mediaPermissions = await ctx.db
      .query("permissions")
      .withIndex("by_category", (q) => q.eq("category", "media"))
      .collect();
    const uploadPermissionId =
      mediaPermissions.find((permission) => permission.name === "media.upload")
        ?._id ??
      (await ctx.db.insert("permissions", {
        name: "media.upload",
        category: "media",
      }));

    const organizationsPage = await ctx.db.query("organizations").paginate({
      numItems: 100,
      cursor: args.cursor ?? null,
    });
    let rolePermissionsAdded = 0;

    for (const organization of organizationsPage.page) {
      for (const roleName of [
        COLLECTION_MANAGER_ROLE_NAME,
        LEGACY_REGISTRAR_ROLE_NAME,
      ]) {
        const role = await ctx.db
          .query("roles")
          .withIndex("by_organization_and_name", (q) =>
            q.eq("organizationId", organization._id).eq("name", roleName),
          )
          .first();
        if (!role?.isSystemRole) {
          continue;
        }

        const rolePermissions = await ctx.db
          .query("rolePermissions")
          .withIndex("by_role", (q) => q.eq("roleId", role._id))
          .collect();
        if (
          rolePermissions.some(
            (entry) => entry.permissionId === uploadPermissionId,
          )
        ) {
          continue;
        }

        await ctx.db.insert("rolePermissions", {
          roleId: role._id,
          permissionId: uploadPermissionId,
        });
        rolePermissionsAdded += 1;
      }
    }

    if (!organizationsPage.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.grantCollectionManagerMediaUpload,
        { cursor: organizationsPage.continueCursor },
      );
    }

    return {
      organizationsScanned: organizationsPage.page.length,
      rolePermissionsAdded,
      isDone: organizationsPage.isDone,
      continueCursor: organizationsPage.isDone
        ? null
        : organizationsPage.continueCursor,
    };
  },
});

/**
 * Migration: Restore uploads stranded in "processing" by the earlier
 * thumbnail job, which marked completed originals as processing and never
 * restored them. Chunked uploads that are genuinely in progress are skipped.
 * Bounded and rerunnable; continues itself page by page.
 *
 * npx convex run migrations:recoverStrandedMediaUploads
 */
export const recoverStrandedMediaUploads = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.object({ recovered: v.number(), isDone: v.boolean() }),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("mediaFiles")
      .withIndex("by_uploadStatus", (q) => q.eq("uploadStatus", "processing"))
      .paginate({ numItems: 50, cursor: args.cursor ?? null });
    let recovered = 0;
    for (const media of page.page) {
      if (media.chunkedUploadId) continue;
      if (!(await ctx.db.system.get(media.storageId))) continue;
      await ctx.db.patch(media._id, { uploadStatus: "completed" });
      await syncPublicRendition(ctx, media._id);
      recovered += 1;
      if (media.isPrimary && !media.thumbnailStorageId) {
        await ctx.scheduler.runAfter(0, internal.media.generateThumbnail, {
          mediaId: media._id,
        });
      }
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.recoverStrandedMediaUploads,
        { cursor: page.continueCursor },
      );
    }
    console.log(`Recovered ${recovered} stranded media uploads`);
    return { recovered, isDone: page.isDone };
  },
});

/**
 * Migration: Leave one primary image on objects that uploads flagged with
 * several (MUS-672). Keeps each object's oldest primary image and clears the
 * flag from the others; objects with one primary file or none are untouched.
 * Bounded and rerunnable; continues itself page by page.
 *
 * bun run convex:local -- run migrations:repairDuplicatePrimaryImages
 */
export const repairDuplicatePrimaryImages = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.object({ cleared: v.number(), isDone: v.boolean() }),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("collections")
      .paginate({ numItems: 50, cursor: args.cursor ?? null });
    const clearedPerObject = await Promise.all(
      page.page.map((collection) =>
        keepOldestPrimaryImage(ctx, collection._id),
      ),
    );
    const cleared = clearedPerObject.reduce((sum, count) => sum + count, 0);
    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.repairDuplicatePrimaryImages,
        { cursor: page.continueCursor },
      );
    }
    console.log(`Cleared ${cleared} extra primary media flags`);
    return { cleared, isDone: page.isDone };
  },
});

/**
 * Migration: create or refresh the search document of every accession, in
 * bounded pages. Rerunnable; each page schedules the next.
 * Run: bunx convex run migrations:backfillAccessionSearchDocuments '{"cursor":null}'
 */
export const backfillAccessionSearchDocuments = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.object({
    processed: v.number(),
    isDone: v.boolean(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ processed: number; isDone: boolean }> => {
    const page = await ctx.db
      .query("accessions")
      .paginate({ cursor: args.cursor, numItems: 100 });
    for (const accession of page.page) {
      await upsertAccessionSearchDocument(ctx, accession);
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.backfillAccessionSearchDocuments,
        { cursor: page.continueCursor },
      );
    }
    return { processed: page.page.length, isDone: page.isDone };
  },
});

/**
 * Migration: grant collections.accept_condition on existing system roles.
 *
 * Run: bunx convex run migrations:grantConditionAssessmentReviewPermissions
 */
export const grantConditionAssessmentReviewPermissions = internalMutation({
  args: {},
  returns: v.object({ organizationsProcessed: v.number() }),
  handler: async (ctx) => {
    const organizations = await ctx.db.query("organizations").collect();
    for (const organization of organizations) {
      await ctx.runMutation(
        internal.conditionAssessmentMigration.grantReviewPermission,
        { organizationId: organization._id },
      );
    }
    return { organizationsProcessed: organizations.length };
  },
});

/**
 * Migration: grant collections.review_provenance on existing system roles
 * (owner, administrator, curator, collection manager / registrar). Runs in
 * pages of organizations and schedules the next page; safe to rerun.
 *
 * Run: bunx convex run migrations:grantProvenanceReviewPermissions
 */
export const grantProvenanceReviewPermissions = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.object({
    organizationsProcessed: v.number(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("organizations")
      .paginate({ numItems: 25, cursor: args.cursor ?? null });
    for (const organization of page.page) {
      await ctx.runMutation(
        internal.provenanceMigration.grantReviewPermission,
        { organizationId: organization._id },
      );
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.grantProvenanceReviewPermissions,
        { cursor: page.continueCursor },
      );
    }
    return { organizationsProcessed: page.page.length, isDone: page.isDone };
  },
});

/**
 * Migration: grant collections.coordinate_incidents on existing system roles
 * (owner, administrator, curator, collection manager / registrar). Runs in
 * pages of organizations and schedules the next page; safe to rerun.
 *
 * Run: bunx convex run migrations:grantIncidentCoordinationPermissions
 */
export const grantIncidentCoordinationPermissions = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.object({
    organizationsProcessed: v.number(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("organizations")
      .paginate({ numItems: 25, cursor: args.cursor ?? null });
    for (const organization of page.page) {
      await grantPermissionToSystemRoles(ctx, {
        organizationId: organization._id,
        name: COORDINATE_PERMISSION,
        description: "Triage incidents, choose response plans and close them",
        roleNames: REVIEWER_SYSTEM_ROLE_NAMES,
      });
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.grantIncidentCoordinationPermissions,
        { cursor: page.continueCursor },
      );
    }
    return { organizationsProcessed: page.page.length, isDone: page.isDone };
  },
});

/** Run once after deploy: bunx convex run migrations:grantValuationPermissions */
export const grantValuationPermissions = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.object({
    organizationsProcessed: v.number(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("organizations")
      .paginate({ numItems: 25, cursor: args.cursor ?? null });
    for (const organization of page.page) {
      await grantPermissionToSystemRoles(ctx, {
        organizationId: organization._id,
        name: VALUATION_PERMISSION,
        description: "View object valuations and appraisal history",
        roleNames: VALUATION_SYSTEM_ROLE_NAMES,
      });
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.grantValuationPermissions,
        { cursor: page.continueCursor },
      );
    }
    return { organizationsProcessed: page.page.length, isDone: page.isDone };
  },
});

async function staffUnpublishedBeforePublicByDefault(
  ctx: MutationCtx,
  media: Doc<"mediaFiles">,
) {
  if (media.publicApproval) return false;
  const [approved, unpublished] = await Promise.all(
    ["approved_public_media", "unpublished_public_media"].map((action) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_entityType_and_entityId_and_action", (q) =>
          q
            .eq("entityType", "media")
            .eq("entityId", media._id)
            .eq("action", action),
        )
        .order("desc")
        .first(),
    ),
  );
  if (!unpublished) return false;
  return !approved || unpublished._creationTime > approved._creationTime;
}

export const backfillPublicRenditions = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.object({ processed: v.number(), isDone: v.boolean() }),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("mediaFiles")
      .paginate({ numItems: 50, cursor: args.cursor });
    for (const media of page.page) {
      if (
        media.portalChoice === undefined &&
        (await staffUnpublishedBeforePublicByDefault(ctx, media))
      ) {
        await ctx.db.patch(media._id, { portalChoice: "hidden" });
      }
      await syncPublicRendition(ctx, media._id);
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.backfillPublicRenditions,
        { cursor: page.continueCursor },
      );
    }
    return { processed: page.page.length, isDone: page.isDone };
  },
});

/**
 * Migration: repair Objects that transfers moved before the receiver's
 * register and the Object's provenance followed them. For every executed
 * transfer:
 * - the Object's identifier key is rewritten when it no longer matches its
 *   number, so the receiver's register finds it by the number it has;
 * - provenance claims, evidence and reviews still filed under the sender
 *   move to the organization holding the Object now.
 * No number changes and nothing is deleted. `sharedNumbers` counts Objects
 * whose number another Object took meanwhile; both are kept as they are and
 * listed in Settings › Preferences identifier review. Rerunnable; each page
 * schedules the next.
 *
 * Run: bunx convex run migrations:repairTransferredObjects '{"cursor":null}'
 */
export const repairTransferredObjects = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.object({
    identifierKeysRewritten: v.number(),
    sharedNumbers: v.number(),
    provenanceRecordsMoved: v.number(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("organizationMoveRequests")
      .paginate({ cursor: args.cursor, numItems: 25 });
    let identifierKeysRewritten = 0;
    let sharedNumbers = 0;
    let provenanceRecordsMoved = 0;
    for (const request of page.page) {
      if (request.status !== "executed") continue;
      const object = await ctx.db.get(request.collectionId);
      if (!object) continue;
      const normalizedIdentifier = normalizeIdentifier(object.accessionNumber);
      if (object.normalizedIdentifier !== normalizedIdentifier) {
        await ctx.db.patch(object._id, { normalizedIdentifier });
        identifierKeysRewritten += 1;
        const sharing = await ctx.db
          .query("collections")
          .withIndex("by_organization_and_normalizedIdentifier", (q) =>
            q
              .eq("organizationId", object.organizationId)
              .eq("normalizedIdentifier", normalizedIdentifier),
          )
          .take(2);
        if (sharing.length > 1) sharedNumbers += 1;
      }
      if (request.sourceOrganizationId !== object.organizationId) {
        provenanceRecordsMoved += await rehomeObjectProvenance(ctx, {
          objectId: object._id,
          fromOrganizationId: request.sourceOrganizationId,
          toOrganizationId: object.organizationId,
        });
      }
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.repairTransferredObjects,
        { cursor: page.continueCursor },
      );
    }
    console.log(
      `Rewrote ${identifierKeysRewritten} identifier keys (${sharedNumbers} shared with another Object), moved ${provenanceRecordsMoved} provenance records`,
    );
    return {
      identifierKeysRewritten,
      sharedNumbers,
      provenanceRecordsMoved,
      isDone: page.isDone,
    };
  },
});
