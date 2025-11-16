import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

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
      const key = `${location.organizationId}:${location.parentLocationId || 'root'}`;
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
        const sortedLocations = locations.sort((a, b) => a._creationTime - b._creationTime);
        
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
              q.eq(q.field("isSystemRole"), true)
            )
          )
          .first();

        if (!adminRole) {
          console.warn(`No admin role found for ${org.name}`);
          errorCount++;
          continue;
        }

        // Create default deaccession workflow
        await ctx.db.insert("workflowConfigs", {
          organizationId: org._id,
          workflowType: "deaccession",
          steps: [
            {
              stepNumber: 1,
              roleId: adminRole._id,
              name: "Administrator Approval",
            },
          ],
          canInitiateRoles: [adminRole._id],
        });

        // Create default accession workflow
        await ctx.db.insert("workflowConfigs", {
          organizationId: org._id,
          workflowType: "accession",
          steps: [
            {
              stepNumber: 1,
              roleId: adminRole._id,
              name: "Administrator Approval",
            },
          ],
          canInitiateRoles: [adminRole._id],
        });

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
