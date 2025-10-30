import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requirePermission } from "./utils/permissions";

/**
 * Create location
 */
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    type: v.string(),
    parentLocationId: v.optional(v.id("locations")),
    address: v.optional(v.string()),
    coordinates: v.optional(
      v.object({
        latitude: v.number(),
        longitude: v.number(),
      }),
    ),
    notes: v.optional(v.string()),
    customFields: v.optional(v.record(v.string(), v.any())),
  },
  returns: v.id("locations"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check permission
    await requirePermission(ctx, args.organizationId, "locations.create");

    // Validate parent location if provided
    if (args.parentLocationId) {
      const parent = await ctx.db.get(args.parentLocationId);
      if (!parent || parent.organizationId !== args.organizationId) {
        throw new Error("Invalid parent location");
      }
      if (!parent.isActive) {
        throw new Error("Parent location is not active");
      }
    }

    // Create location
    const locationId = await ctx.db.insert("locations", {
      organizationId: args.organizationId,
      name: args.name,
      type: args.type,
      parentLocationId: args.parentLocationId,
      address: args.address,
      coordinates: args.coordinates,
      notes: args.notes,
      isActive: true,
      customFields: args.customFields,
    });

    return locationId;
  },
});

/**
 * List locations (hierarchical tree)
 */
export const list = query({
  args: {
    organizationId: v.id("organizations"),
    parentLocationId: v.optional(v.union(v.id("locations"), v.literal("root"))),
  },
  returns: v.array(
    v.object({
      _id: v.id("locations"),
      name: v.string(),
      type: v.string(),
      parentLocationId: v.optional(v.id("locations")),
      address: v.optional(v.string()),
      coordinates: v.optional(
        v.object({
          latitude: v.number(),
          longitude: v.number(),
        }),
      ),
      notes: v.optional(v.string()),
      isActive: v.boolean(),
      children: v.optional(
        v.array(
          v.object({
            _id: v.id("locations"),
            name: v.string(),
            type: v.string(),
            isActive: v.boolean(),
          }),
        ),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    // Check permission
    await requirePermission(ctx, args.organizationId, "locations.read");

    let query = ctx.db
      .query("locations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("isActive"), true));

    // Filter by parent
    if (args.parentLocationId === "root") {
      query = query.filter((q) =>
        q.eq(q.field("parentLocationId"), undefined),
      );
    } else if (args.parentLocationId) {
      query = query.filter((q) =>
        q.eq(q.field("parentLocationId"), args.parentLocationId),
      );
    }

    const locations = await query.collect();

    // Build hierarchical structure
    const locationsWithChildren = await Promise.all(
      locations.map(async (location) => {
        const children = await ctx.db
          .query("locations")
          .withIndex("by_parentLocation", (q) =>
            q.eq("parentLocationId", location._id),
          )
          .filter((q) => q.eq(q.field("isActive"), true))
          .collect();

        return {
          _id: location._id,
          name: location.name,
          type: location.type,
          parentLocationId: location.parentLocationId,
          address: location.address,
          coordinates: location.coordinates,
          notes: location.notes,
          isActive: location.isActive,
          children: children.map((child) => ({
            _id: child._id,
            name: child.name,
            type: child.type,
            isActive: child.isActive,
          })),
        };
      }),
    );

    return locationsWithChildren;
  },
});

/**
 * Get location with children
 */
export const get = query({
  args: {
    locationId: v.id("locations"),
  },
  returns: v.union(
    v.object({
      _id: v.id("locations"),
      organizationId: v.id("organizations"),
      name: v.string(),
      type: v.string(),
      parentLocationId: v.optional(v.id("locations")),
      address: v.optional(v.string()),
      coordinates: v.optional(
        v.object({
          latitude: v.number(),
          longitude: v.number(),
        }),
      ),
      notes: v.optional(v.string()),
      isActive: v.boolean(),
      customFields: v.optional(v.record(v.string(), v.any())),
      children: v.array(
        v.object({
          _id: v.id("locations"),
          name: v.string(),
          type: v.string(),
          isActive: v.boolean(),
        }),
      ),
      objectCount: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const location = await ctx.db.get(args.locationId);
    if (!location) {
      return null;
    }

    await requirePermission(
      ctx,
      location.organizationId,
      "locations.read",
    );

    // Get children
    const children = await ctx.db
      .query("locations")
      .withIndex("by_parentLocation", (q) =>
        q.eq("parentLocationId", args.locationId),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Count objects at this location
    const objects = await ctx.db
      .query("collections")
      .withIndex("by_currentLocation", (q) =>
        q.eq("currentLocationId", args.locationId),
      )
      .collect();

    return {
      _id: location._id,
      organizationId: location.organizationId,
      name: location.name,
      type: location.type,
      parentLocationId: location.parentLocationId,
      address: location.address,
      coordinates: location.coordinates,
      notes: location.notes,
      isActive: location.isActive,
      customFields: location.customFields,
      children: children.map((child) => ({
        _id: child._id,
        name: child.name,
        type: child.type,
        isActive: child.isActive,
      })),
      objectCount: objects.length,
    };
  },
});

/**
 * Update location
 */
export const update = mutation({
  args: {
    locationId: v.id("locations"),
    name: v.optional(v.string()),
    type: v.optional(v.string()),
    parentLocationId: v.optional(v.id("locations")),
    address: v.optional(v.string()),
    coordinates: v.optional(
      v.object({
        latitude: v.number(),
        longitude: v.number(),
      }),
    ),
    notes: v.optional(v.string()),
    customFields: v.optional(v.record(v.string(), v.any())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const location = await ctx.db.get(args.locationId);
    if (!location) {
      throw new Error("Location not found");
    }

    // Check permission
    await requirePermission(ctx, location.organizationId, "locations.update");

    // Validate parent location if changing
    if (
      args.parentLocationId !== undefined &&
      args.parentLocationId !== location.parentLocationId
    ) {
      if (args.parentLocationId) {
        const parent = await ctx.db.get(args.parentLocationId);
        if (!parent || parent.organizationId !== location.organizationId) {
          throw new Error("Invalid parent location");
        }
        if (!parent.isActive) {
          throw new Error("Parent location is not active");
        }
      }

      // Prevent circular references
      if (args.parentLocationId === args.locationId) {
        throw new Error("Cannot set location as its own parent");
      }

      // Check if creating a cycle
      let currentParentId: Id<"locations"> | undefined = args.parentLocationId;
      while (currentParentId) {
        if (currentParentId === args.locationId) {
          throw new Error("Cannot create circular location hierarchy");
        }
        const currentParent = await ctx.db.get(currentParentId);
        currentParentId = currentParent?.parentLocationId;
      }
    }

    // Build update object
    const updates: {
      name?: string;
      type?: string;
      parentLocationId?: Id<"locations">;
      address?: string;
      coordinates?: { latitude: number; longitude: number };
      notes?: string;
      customFields?: Record<string, any>;
    } = {};

    if (args.name !== undefined) updates.name = args.name;
    if (args.type !== undefined) updates.type = args.type;
    if (args.parentLocationId !== undefined)
      updates.parentLocationId = args.parentLocationId;
    if (args.address !== undefined) updates.address = args.address;
    if (args.coordinates !== undefined) updates.coordinates = args.coordinates;
    if (args.notes !== undefined) updates.notes = args.notes;
    if (args.customFields !== undefined)
      updates.customFields = args.customFields;

    await ctx.db.patch(args.locationId, updates);

    return null;
  },
});

/**
 * Soft delete location
 */
export const deleteLocation = mutation({
  args: {
    locationId: v.id("locations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const location = await ctx.db.get(args.locationId);
    if (!location) {
      throw new Error("Location not found");
    }

    // Check permission
    await requirePermission(ctx, location.organizationId, "locations.delete");

    // Check if location has children
    const children = await ctx.db
      .query("locations")
      .withIndex("by_parentLocation", (q) =>
        q.eq("parentLocationId", args.locationId),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (children) {
      throw new Error("Cannot delete location with active children");
    }

    // Check if location has objects
    const objects = await ctx.db
      .query("collections")
      .withIndex("by_currentLocation", (q) =>
        q.eq("currentLocationId", args.locationId),
      )
      .first();

    if (objects) {
      throw new Error("Cannot delete location with objects");
    }

    // Soft delete
    await ctx.db.patch(args.locationId, {
      isActive: false,
    });

    return null;
  },
});

/**
 * Move object to new location (creates history)
 */
export const moveObject = mutation({
  args: {
    collectionId: v.id("collections"),
    toLocationId: v.id("locations"),
    reason: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      throw new Error("Collection not found");
    }

    const toLocation = await ctx.db.get(args.toLocationId);
    if (!toLocation) {
      throw new Error("Target location not found");
    }

    // Check permission
    await requirePermission(
      ctx,
      collection.organizationId,
      "locations.update",
    );

    // Verify location belongs to same organization
    if (toLocation.organizationId !== collection.organizationId) {
      throw new Error("Location belongs to different organization");
    }

    if (!toLocation.isActive) {
      throw new Error("Target location is not active");
    }

    const fromLocationId = collection.currentLocationId;

    // Create location history entry
    await ctx.db.insert("locationHistory", {
      collectionId: args.collectionId,
      fromLocationId,
      toLocationId: args.toLocationId,
      movedBy: userId,
      movedAt: Date.now(),
      reason: args.reason,
      notes: args.notes,
    });

    // Update collection location
    await ctx.db.patch(args.collectionId, {
      currentLocationId: args.toLocationId,
      lastModifiedBy: userId,
      lastModifiedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Get full location path (building → room → cabinet)
 */
export const getLocationPath = query({
  args: {
    locationId: v.id("locations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("locations"),
      name: v.string(),
      type: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const path: Array<{
      _id: Id<"locations">;
      name: string;
      type: string;
    }> = [];

    let currentLocationId: Id<"locations"> | undefined = args.locationId;

    while (currentLocationId) {
      const location = await ctx.db.get(currentLocationId);
      if (!location) break;

      path.unshift({
        _id: location._id,
        name: location.name,
        type: location.type,
      });

      currentLocationId = location.parentLocationId;
    }

    return path;
  },
});

/**
 * Get all objects at a location
 */
export const getObjectsAtLocation = query({
  args: {
    locationId: v.id("locations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("collections"),
      accessionNumber: v.string(),
      title: v.string(),
      status: v.union(
        v.literal("active"),
        v.literal("loaned"),
        v.literal("deaccessioned"),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const location = await ctx.db.get(args.locationId);
    if (!location) {
      throw new Error("Location not found");
    }

    await requirePermission(ctx, location.organizationId, "locations.read");

    const objects = await ctx.db
      .query("collections")
      .withIndex("by_currentLocation", (q) =>
        q.eq("currentLocationId", args.locationId),
      )
      .collect();

    return objects.map((obj) => ({
      _id: obj._id,
      accessionNumber: obj.accessionNumber,
      title: obj.title,
      status: obj.status,
    }));
  },
});

/**
 * Get available location types for organization
 */
export const getLocationTypes = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new Error("Organization not found");
    }

    // Return custom types if configured, otherwise default types
    if (org.settings?.locationTypes && org.settings.locationTypes.length > 0) {
      return org.settings.locationTypes;
    }

    return [
      "building",
      "floor",
      "room",
      "cabinet",
      "shelf",
      "box",
      "storage",
    ];
  },
});

/**
 * Get location history for a collection object
 */
export const getCollectionLocationHistory = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.array(
    v.object({
      _id: v.id("locationHistory"),
      _creationTime: v.number(),
      collectionId: v.id("collections"),
      fromLocationId: v.optional(v.id("locations")),
      toLocationId: v.id("locations"),
      movedBy: v.id("users"),
      movedAt: v.number(),
      reason: v.optional(v.string()),
      notes: v.optional(v.string()),
      fromLocationName: v.optional(v.string()),
      toLocationName: v.string(),
      movedByName: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      throw new Error("Collection not found");
    }

    await requirePermission(ctx, collection.organizationId, "collections.read");

    const history = await ctx.db
      .query("locationHistory")
      .withIndex("by_collection", (q) => q.eq("collectionId", args.collectionId))
      .order("desc")
      .collect();

    const enrichedHistory = await Promise.all(
      history.map(async (entry) => {
        const fromLocation = entry.fromLocationId
          ? await ctx.db.get(entry.fromLocationId)
          : null;
        const toLocation = await ctx.db.get(entry.toLocationId);
        const movedBy = await ctx.db.get(entry.movedBy);

        return {
          ...entry,
          fromLocationName: fromLocation?.name || undefined,
          toLocationName: toLocation?.name || "",
          movedByName: movedBy?.name || movedBy?.username || undefined,
        };
      }),
    );

    return enrichedHistory;
  },
});
