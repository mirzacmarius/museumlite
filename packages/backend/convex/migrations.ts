import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";

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

    let updatedCount = 0;
    let errorCount = 0;

    for (const [key, locations] of locationsByParent) {
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
        updatedCount += locationPatches.length;

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
        const [adminRole, registrarRole] = await Promise.all([
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
          ctx.db
            .query("roles")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", org._id),
            )
            .filter((q) =>
              q.and(
                q.eq(q.field("name"), "registrar"),
                q.eq(q.field("isSystemRole"), true),
              ),
            )
            .first(),
        ]);

        const rolesToUpdate = [
          { role: adminRole, name: "admin" },
          { role: registrarRole, name: "registrar" },
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

        const readOnlyRoles = ["curator", "registrar", "cataloger", "viewer"];
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
