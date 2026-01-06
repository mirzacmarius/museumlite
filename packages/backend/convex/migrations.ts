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
