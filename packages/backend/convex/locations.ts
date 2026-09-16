import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { customFieldValue } from "./schema";
import { hasPermission, requirePermission } from "./utils/permissions";

const MAX_LOCATION_CODE_LENGTH = 50;
type LocationCustomFields = Record<
  string,
  string | number | boolean | string[] | null
>;

function normalizeLocationCode(locationCode: string) {
  return locationCode.trim().toLowerCase();
}

function validateLocationCode(locationCode: string) {
  const trimmedLocationCode = locationCode.trim();
  if (!trimmedLocationCode) {
    throw new Error("Please enter a location ID");
  }
  if (trimmedLocationCode.length > MAX_LOCATION_CODE_LENGTH) {
    throw new Error("Location ID must be 50 characters or fewer");
  }

  return {
    locationCode: trimmedLocationCode,
    locationCodeNormalized: normalizeLocationCode(trimmedLocationCode),
  };
}

function getFallbackLocationCode(locationId: Id<"locations">) {
  return `LEGACY-${locationId.slice(-6).toUpperCase()}`;
}

function getLocationCodeValue(location: {
  _id: Id<"locations">;
  locationCode?: string;
}) {
  return location.locationCode ?? getFallbackLocationCode(location._id);
}

function getLocationCodeNormalizedValue(location: {
  _id: Id<"locations">;
  locationCode?: string;
  locationCodeNormalized?: string;
}) {
  if (location.locationCodeNormalized) {
    return location.locationCodeNormalized;
  }

  return normalizeLocationCode(getLocationCodeValue(location));
}

async function ensureUniqueSiblingLocationCode(
  ctx: MutationCtx | QueryCtx,
  {
    organizationId,
    parentLocationId,
    locationCodeNormalized,
    excludeLocationId,
  }: {
    organizationId: Id<"organizations">;
    parentLocationId?: Id<"locations">;
    locationCodeNormalized: string;
    excludeLocationId?: Id<"locations">;
  },
) {
  const existingLocations = await ctx.db
    .query("locations")
    .withIndex("by_organization_and_parent_and_locationCodeNormalized", (q) =>
      q
        .eq("organizationId", organizationId)
        .eq("parentLocationId", parentLocationId)
        .eq("locationCodeNormalized", locationCodeNormalized),
    )
    .collect();

  const duplicateLocation = existingLocations.find(
    (location) => location._id !== excludeLocationId,
  );

  if (duplicateLocation) {
    throw new Error("Location ID already exists in this parent location");
  }
}

async function validateSite(
  ctx: MutationCtx | QueryCtx,
  organizationId: Id<"organizations">,
  siteId: Id<"sites">,
) {
  const site = await ctx.db.get(siteId);
  if (!site || site.organizationId !== organizationId) {
    throw new Error("Invalid site");
  }
  if (!site.isActive) {
    throw new Error("Site is not active");
  }
  return site;
}

/**
 * Create location
 */
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    siteId: v.optional(v.id("sites")),
    name: v.string(),
    locationCode: v.string(),
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
    capacity: v.optional(v.number()),
    customFields: v.optional(v.record(v.string(), customFieldValue)),
  },
  returns: v.id("locations"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check permission
    await requirePermission(ctx, args.organizationId, "locations.create");

    if (args.siteId) {
      await validateSite(ctx, args.organizationId, args.siteId);
    }

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

    const { locationCode, locationCodeNormalized } = validateLocationCode(
      args.locationCode,
    );

    await ensureUniqueSiblingLocationCode(ctx, {
      organizationId: args.organizationId,
      parentLocationId: args.parentLocationId,
      locationCodeNormalized,
    });

    // Calculate sortOrder - get max sortOrder for siblings and add 1
    const siblings = await ctx.db
      .query("locations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => {
        if (args.parentLocationId) {
          return q.eq(q.field("parentLocationId"), args.parentLocationId);
        }
        return q.eq(q.field("parentLocationId"), undefined);
      })
      .collect();

    const maxSortOrder = siblings.reduce(
      (max, loc) => Math.max(max, loc.sortOrder || 0),
      0,
    );

    const locationId = await ctx.db.insert("locations", {
      organizationId: args.organizationId,
      siteId: args.siteId,
      name: args.name,
      locationCode,
      locationCodeNormalized,
      type: args.type,
      parentLocationId: args.parentLocationId,
      sortOrder: maxSortOrder + 1,
      address: args.address,
      coordinates: args.coordinates,
      notes: args.notes,
      isActive: true,
      capacity: args.capacity,
      customFields: args.customFields,
    });

    return locationId;
  },
});

/**
 * List all locations in a flat list (for parent selection)
 */
export const listAll = query({
  args: {
    organizationId: v.id("organizations"),
    siteId: v.optional(v.id("sites")),
  },
  returns: v.array(
    v.object({
      _id: v.id("locations"),
      name: v.string(),
      locationCode: v.string(),
      type: v.string(),
      parentLocationId: v.optional(v.id("locations")),
      sortOrder: v.number(),
      isActive: v.boolean(),
      address: v.optional(v.string()),
      notes: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "locations.read");

    if (args.siteId) {
      await validateSite(ctx, args.organizationId, args.siteId);
    }

    const baseQuery = args.siteId
      ? ctx.db
          .query("locations")
          .withIndex("by_organization_and_site", (q) =>
            q
              .eq("organizationId", args.organizationId)
              .eq("siteId", args.siteId),
          )
      : ctx.db
          .query("locations")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", args.organizationId),
          );

    const locations = await baseQuery
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Sort by sortOrder for proper display order
    const sortedLocations = locations.sort((a, b) => a.sortOrder - b.sortOrder);

    return sortedLocations.map((loc) => ({
      _id: loc._id,
      name: loc.name,
      locationCode: getLocationCodeValue(loc),
      type: loc.type,
      parentLocationId: loc.parentLocationId,
      sortOrder: loc.sortOrder,
      isActive: loc.isActive,
      address: loc.address,
      notes: loc.notes,
    }));
  },
});

/**
 * List locations for a specific site
 */
export const listBySite = query({
  args: {
    organizationId: v.id("organizations"),
    siteId: v.id("sites"),
  },
  returns: v.array(
    v.object({
      _id: v.id("locations"),
      name: v.string(),
      locationCode: v.string(),
      type: v.string(),
      parentLocationId: v.optional(v.id("locations")),
      sortOrder: v.number(),
      isActive: v.boolean(),
      siteId: v.optional(v.id("sites")),
    }),
  ),
  handler: async (ctx, args) => {
    await Promise.all([
      requirePermission(ctx, args.organizationId, "locations.read"),
      validateSite(ctx, args.organizationId, args.siteId),
    ]);
    const locations = await ctx.db
      .query("locations")
      .withIndex("by_organization_and_site", (q) =>
        q.eq("organizationId", args.organizationId).eq("siteId", args.siteId),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const sortedLocations = locations.sort((a, b) => a.sortOrder - b.sortOrder);

    return sortedLocations.map((loc) => ({
      _id: loc._id,
      name: loc.name,
      locationCode: getLocationCodeValue(loc),
      type: loc.type,
      parentLocationId: loc.parentLocationId,
      sortOrder: loc.sortOrder,
      isActive: loc.isActive,
      siteId: loc.siteId,
    }));
  },
});

/**
 * List locations (hierarchical tree)
 */
export const list = query({
  args: {
    organizationId: v.id("organizations"),
    parentLocationId: v.optional(v.union(v.id("locations"), v.literal("root"))),
    siteId: v.optional(v.id("sites")),
  },
  returns: v.array(
    v.object({
      _id: v.id("locations"),
      name: v.string(),
      locationCode: v.string(),
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
            locationCode: v.string(),
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

    if (args.siteId) {
      await validateSite(ctx, args.organizationId, args.siteId);
    }

    let query = (
      args.siteId
        ? ctx.db
            .query("locations")
            .withIndex("by_organization_and_site", (q) =>
              q
                .eq("organizationId", args.organizationId)
                .eq("siteId", args.siteId),
            )
        : ctx.db
            .query("locations")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", args.organizationId),
            )
    ).filter((q) => q.eq(q.field("isActive"), true));

    // Filter by parent
    if (args.parentLocationId === "root") {
      query = query.filter((q) => q.eq(q.field("parentLocationId"), undefined));
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
          locationCode: getLocationCodeValue(location),
          type: location.type,
          parentLocationId: location.parentLocationId,
          address: location.address,
          coordinates: location.coordinates,
          notes: location.notes,
          isActive: location.isActive,
          children: children.map((child) => ({
            _id: child._id,
            name: child.name,
            locationCode: getLocationCodeValue(child),
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
      locationCode: v.string(),
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
      capacity: v.optional(v.number()),
      customFields: v.optional(v.record(v.string(), customFieldValue)),
      imageUrl: v.optional(v.string()),
      children: v.array(
        v.object({
          _id: v.id("locations"),
          name: v.string(),
          locationCode: v.string(),
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

    await requirePermission(ctx, location.organizationId, "locations.read");

    const locationImageId =
      typeof location.customFields?.locationImageId === "string"
        ? (location.customFields.locationImageId as Id<"_storage">)
        : undefined;
    const imageUrl = locationImageId
      ? ((await ctx.storage.getUrl(locationImageId)) ?? undefined)
      : undefined;

    // Get children
    const [children, objects] = await Promise.all([
      ctx.db
        .query("locations")
        .withIndex("by_parentLocation", (q) =>
          q.eq("parentLocationId", args.locationId),
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect(),
      ctx.db
        .query("collections")
        .withIndex("by_currentLocation", (q) =>
          q.eq("currentLocationId", args.locationId),
        )
        .collect(),
    ] as const);

    // Count objects at this location
    return {
      _id: location._id,
      organizationId: location.organizationId,
      name: location.name,
      locationCode: getLocationCodeValue(location),
      type: location.type,
      parentLocationId: location.parentLocationId,
      address: location.address,
      coordinates: location.coordinates,
      notes: location.notes,
      isActive: location.isActive,
      capacity: location.capacity,
      customFields: location.customFields,
      imageUrl,
      children: children.map((child) => ({
        _id: child._id,
        name: child.name,
        locationCode: getLocationCodeValue(child),
        type: child.type,
        isActive: child.isActive,
      })),
      objectCount: objects.length,
    };
  },
});

export const update = mutation({
  args: {
    locationId: v.id("locations"),
    siteId: v.optional(v.id("sites")),
    name: v.optional(v.string()),
    locationCode: v.optional(v.string()),
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
    capacity: v.optional(v.number()),
    customFields: v.optional(v.record(v.string(), customFieldValue)),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, location] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.locationId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!location) {
      throw new Error("Location not found");
    }

    // Check permission
    await requirePermission(ctx, location.organizationId, "locations.update");

    if (args.siteId !== undefined && args.siteId !== location.siteId) {
      if (args.siteId) {
        await validateSite(ctx, location.organizationId, args.siteId);
      }
    }

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
        const currentParent: { parentLocationId?: Id<"locations"> } | null =
          await ctx.db.get(currentParentId);
        currentParentId = currentParent?.parentLocationId;
      }
    }

    const nextParentLocationId =
      args.parentLocationId !== undefined
        ? args.parentLocationId
        : location.parentLocationId;

    if (
      args.parentLocationId !== undefined &&
      args.parentLocationId !== location.parentLocationId &&
      args.locationCode === undefined
    ) {
      await ensureUniqueSiblingLocationCode(ctx, {
        organizationId: location.organizationId,
        parentLocationId: nextParentLocationId,
        locationCodeNormalized: getLocationCodeNormalizedValue(location),
        excludeLocationId: args.locationId,
      });
    }

    const updates: {
      siteId?: Id<"sites">;
      name?: string;
      locationCode?: string;
      locationCodeNormalized?: string;
      type?: string;
      parentLocationId?: Id<"locations">;
      address?: string;
      coordinates?: { latitude: number; longitude: number };
      notes?: string;
      capacity?: number;
      customFields?: LocationCustomFields;
    } = {};

    if (args.siteId !== undefined) updates.siteId = args.siteId;
    if (args.name !== undefined) updates.name = args.name;
    if (args.locationCode !== undefined) {
      const { locationCode, locationCodeNormalized } = validateLocationCode(
        args.locationCode,
      );
      await ensureUniqueSiblingLocationCode(ctx, {
        organizationId: location.organizationId,
        parentLocationId: nextParentLocationId,
        locationCodeNormalized,
        excludeLocationId: args.locationId,
      });
      updates.locationCode = locationCode;
      updates.locationCodeNormalized = locationCodeNormalized;
    }
    if (args.type !== undefined) updates.type = args.type;
    if (args.parentLocationId !== undefined)
      updates.parentLocationId = args.parentLocationId;
    if (args.address !== undefined) updates.address = args.address;
    if (args.coordinates !== undefined) updates.coordinates = args.coordinates;
    if (args.notes !== undefined) updates.notes = args.notes;
    if (args.capacity !== undefined) updates.capacity = args.capacity;
    if (args.customFields !== undefined)
      updates.customFields = args.customFields;

    await ctx.db.patch(args.locationId, updates);

    return null;
  },
});

export const getOccupancy = query({
  args: {
    locationId: v.id("locations"),
  },
  returns: v.union(
    v.object({
      locationId: v.id("locations"),
      name: v.string(),
      capacity: v.optional(v.number()),
      objectCount: v.number(),
      occupancyPercent: v.optional(v.number()),
      isOverCapacity: v.boolean(),
      childrenOccupancy: v.array(
        v.object({
          locationId: v.id("locations"),
          name: v.string(),
          capacity: v.optional(v.number()),
          objectCount: v.number(),
          occupancyPercent: v.optional(v.number()),
          isOverCapacity: v.boolean(),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const location = await ctx.db.get(args.locationId);
    if (!location) {
      return null;
    }

    const [, objects] = await Promise.all([
      requirePermission(ctx, location.organizationId, "locations.read"),
      ctx.db
        .query("collections")
        .withIndex("by_currentLocation", (q) =>
          q.eq("currentLocationId", args.locationId),
        )
        .collect(),
    ] as const);

    const objectCount = objects.length;
    const occupancyPercent = location.capacity
      ? Math.round((objectCount / location.capacity) * 100)
      : undefined;

    const children = await ctx.db
      .query("locations")
      .withIndex("by_parentLocation", (q) =>
        q.eq("parentLocationId", args.locationId),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const childrenOccupancy = await Promise.all(
      children.map(async (child) => {
        const childObjects = await ctx.db
          .query("collections")
          .withIndex("by_currentLocation", (q) =>
            q.eq("currentLocationId", child._id),
          )
          .collect();

        const childObjectCount = childObjects.length;
        const childOccupancyPercent = child.capacity
          ? Math.round((childObjectCount / child.capacity) * 100)
          : undefined;

        return {
          locationId: child._id,
          name: child.name,
          capacity: child.capacity,
          objectCount: childObjectCount,
          occupancyPercent: childOccupancyPercent,
          isOverCapacity: child.capacity
            ? childObjectCount > child.capacity
            : false,
        };
      }),
    );

    return {
      locationId: location._id,
      name: location.name,
      capacity: location.capacity,
      objectCount,
      occupancyPercent,
      isOverCapacity: location.capacity
        ? objectCount > location.capacity
        : false,
      childrenOccupancy,
    };
  },
});

export const getEnvironmentalReadings = query({
  args: {
    locationId: v.id("locations"),
  },
  returns: v.union(
    v.object({
      temperature: v.optional(v.number()),
      humidity: v.optional(v.number()),
      recordedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const location = await ctx.db.get(args.locationId);
    if (!location) {
      return null;
    }

    const [, latestReading] = await Promise.all([
      requirePermission(ctx, location.organizationId, "locations.read"),
      ctx.db
        .query("environmentalReadings")
        .withIndex("by_location_and_time", (q) =>
          q.eq("locationId", args.locationId),
        )
        .order("desc")
        .first(),
    ] as const);

    if (!latestReading) {
      return null;
    }

    return {
      temperature: latestReading.temperature,
      humidity: latestReading.humidity,
      recordedAt: latestReading.recordedAt,
    };
  },
});

export const deleteLocation = mutation({
  args: {
    locationId: v.id("locations"),
    deaccessionReason: v.optional(v.string()),
    deaccessionMethod: v.optional(
      v.union(
        v.literal("sale"),
        v.literal("donation"),
        v.literal("destruction"),
        v.literal("transfer"),
      ),
    ),
    deaccessionNotes: v.optional(v.string()),
    dateDeaccessioned: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, location] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.locationId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!location) {
      throw new Error("Location not found");
    }

    // Check permission
    const [, children] = await Promise.all([
      requirePermission(ctx, location.organizationId, "locations.delete"),
      ctx.db
        .query("locations")
        .withIndex("by_parentLocation", (q) =>
          q.eq("parentLocationId", args.locationId),
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .first(),
    ] as const);

    if (children) {
      throw new Error("Cannot delete location with active children");
    }

    const objects = await ctx.db
      .query("collections")
      .withIndex("by_currentLocation", (q) =>
        q.eq("currentLocationId", args.locationId),
      )
      .collect();

    const objectsRequiringDeaccession: typeof objects = [];

    await Promise.all(
      Array.from(objects).map(async (object) => {
        if (
          object.status === "deaccessioned" ||
          object.status === "archived" ||
          object.status === "deleted"
        ) {
          return;
        }

        const existingDeaccessions = await ctx.db
          .query("deaccessions")
          .withIndex("by_collection", (q) => q.eq("collectionId", object._id))
          .collect();

        const alreadyInFlow = existingDeaccessions.some(
          (deaccession) => deaccession.status !== "rejected",
        );

        if (!alreadyInFlow) {
          objectsRequiringDeaccession.push(object);
        }
      }),
    );

    if (objectsRequiringDeaccession.length > 0) {
      if (!args.deaccessionReason?.trim()) {
        throw new Error(
          "Provide a deaccession reason to send this location's objects into the deaccessions flow before deleting it",
        );
      }

      if (!args.deaccessionMethod) {
        throw new Error("Select a deaccession method before deleting");
      }

      const dateDeaccessioned = args.dateDeaccessioned ?? Date.now();
      const deaccessionReason = args.deaccessionReason.trim();
      const deaccessionMethod = args.deaccessionMethod;

      await Promise.all(
        Array.from(objectsRequiringDeaccession).map(async (object) => {
          await ctx.runMutation(internal.deaccessions.createInternal, {
            organizationId: location.organizationId,
            collectionId: object._id,
            createdByUserId: userId,
            dateDeaccessioned,
            reason: deaccessionReason,
            method: deaccessionMethod,
            notes: args.deaccessionNotes?.trim() || undefined,
          });
        }),
      );
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
    overrideCapacity: v.optional(v.boolean()),
    overrideStatus: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, collection] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.collectionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!collection) {
      throw new Error("Collection not found");
    }

    const toLocation = await ctx.db.get(args.toLocationId);
    if (!toLocation) {
      throw new Error("Target location not found");
    }

    if (toLocation.organizationId !== collection.organizationId) {
      throw new Error("Location belongs to different organization");
    }

    const locationStatus = toLocation.status ?? "active";
    if (!toLocation.isActive || locationStatus === "closed") {
      if (!args.overrideStatus) {
        throw new Error("Target location is closed and cannot receive objects");
      }
    }

    if (locationStatus === "renovation") {
      if (!args.overrideStatus) {
        throw new Error("Target location is under renovation");
      }
    }

    if (locationStatus === "restricted") {
      if (!args.overrideStatus) {
        throw new Error(
          "Target location is restricted. Use override to move objects here.",
        );
      }
    }

    await requirePermission(ctx, collection.organizationId, "locations.update");

    // Check capacity
    if (toLocation.capacity) {
      const objectsAtLocation = await ctx.db
        .query("collections")
        .withIndex("by_currentLocation", (q) =>
          q.eq("currentLocationId", args.toLocationId),
        )
        .collect();

      if (objectsAtLocation.length >= toLocation.capacity) {
        if (!args.overrideCapacity) {
          throw new Error(
            `Target location is at capacity (${objectsAtLocation.length}/${toLocation.capacity})`,
          );
        }
      }
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
 * Check if a move is allowed (capacity and status)
 */
export const checkMoveAllowed = query({
  args: {
    collectionId: v.id("collections"),
    toLocationId: v.id("locations"),
  },
  returns: v.object({
    allowed: v.boolean(),
    requiresOverride: v.boolean(),
    issues: v.array(
      v.object({
        type: v.string(),
        message: v.string(),
        canOverride: v.boolean(),
      }),
    ),
    targetLocation: v.optional(
      v.object({
        name: v.string(),
        status: v.optional(v.string()),
        capacity: v.optional(v.number()),
        currentCount: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      return {
        allowed: false,
        requiresOverride: false,
        issues: [
          {
            type: "error",
            message: "Collection not found",
            canOverride: false,
          },
        ],
      };
    }

    await requirePermission(ctx, collection.organizationId, "collections.read");
    await requirePermission(ctx, collection.organizationId, "locations.read");

    const toLocation = await ctx.db.get(args.toLocationId);
    if (!toLocation) {
      return {
        allowed: false,
        requiresOverride: false,
        issues: [
          { type: "error", message: "Location not found", canOverride: false },
        ],
      };
    }

    if (toLocation.organizationId !== collection.organizationId) {
      throw new Error(
        "Location does not belong to the collection organization",
      );
    }

    const issues: Array<{
      type: string;
      message: string;
      canOverride: boolean;
    }> = [];

    // Check location status
    const locationStatus = toLocation.status ?? "active";
    if (!toLocation.isActive || locationStatus === "closed") {
      issues.push({
        type: "status_closed",
        message: "Location is closed",
        canOverride: true,
      });
    } else if (locationStatus === "renovation") {
      issues.push({
        type: "status_renovation",
        message: "Location is under renovation",
        canOverride: true,
      });
    } else if (locationStatus === "restricted") {
      issues.push({
        type: "status_restricted",
        message: "Location is restricted",
        canOverride: true,
      });
    }

    // Check capacity
    let currentCount = 0;
    if (toLocation.capacity) {
      const objectsAtLocation = await ctx.db
        .query("collections")
        .withIndex("by_currentLocation", (q) =>
          q.eq("currentLocationId", args.toLocationId),
        )
        .collect();

      currentCount = objectsAtLocation.length;

      if (currentCount >= toLocation.capacity) {
        issues.push({
          type: "capacity_exceeded",
          message: `Location is at capacity (${currentCount}/${toLocation.capacity})`,
          canOverride: true,
        });
      }
    }

    return {
      allowed: issues.length === 0,
      requiresOverride: issues.length > 0 && issues.every((i) => i.canOverride),
      issues,
      targetLocation: {
        name: toLocation.name,
        status: locationStatus,
        capacity: toLocation.capacity,
        currentCount,
      },
    };
  },
});

// ============================================================================
// Move Request Workflow
// ============================================================================

/**
 * Create a move request (for approval workflow)
 */
export const createMoveRequest = mutation({
  args: {
    collectionId: v.id("collections"),
    toLocationId: v.id("locations"),
    reason: v.string(),
    scheduledDate: v.optional(v.number()),
    priority: v.optional(
      v.union(v.literal("low"), v.literal("normal"), v.literal("high")),
    ),
    notes: v.optional(v.string()),
  },
  returns: v.id("locationMoveRequests"),
  handler: async (ctx, args) => {
    const [userId, collection] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.collectionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!collection) {
      throw new Error("Collection not found");
    }

    const toLocation = await ctx.db.get(args.toLocationId);
    if (!toLocation) {
      throw new Error("Target location not found");
    }

    if (toLocation.organizationId !== collection.organizationId) {
      throw new Error("Location belongs to different organization");
    }

    const [, existingRequest] = await Promise.all([
      requirePermission(ctx, collection.organizationId, "locations.update"),
      ctx.db
        .query("locationMoveRequests")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", args.collectionId),
        )
        .filter((q) =>
          q.or(
            q.eq(q.field("status"), "pending"),
            q.eq(q.field("status"), "approved"),
          ),
        )
        .first(),
    ] as const);

    if (existingRequest) {
      throw new Error("Object already has a pending move request");
    }

    const requestId = await ctx.db.insert("locationMoveRequests", {
      organizationId: collection.organizationId,
      collectionId: args.collectionId,
      fromLocationId: collection.currentLocationId,
      toLocationId: args.toLocationId,
      reason: args.reason,
      scheduledDate: args.scheduledDate,
      priority: args.priority ?? "normal",
      status: "pending",
      requestedBy: userId,
      requestedAt: Date.now(),
      notes: args.notes,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: collection.organizationId,
      userId,
      action: "created_move_request",
      entityType: "collection",
      entityId: args.collectionId,
      changes: {
        toLocationId: args.toLocationId,
        reason: args.reason,
      },
    });

    return requestId;
  },
});

/**
 * Approve a move request
 */
export const approveMoveRequest = mutation({
  args: {
    requestId: v.id("locationMoveRequests"),
    reviewNotes: v.optional(v.string()),
    overrideCapacity: v.optional(v.boolean()),
    overrideStatus: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, request] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.requestId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!request) {
      throw new Error("Move request not found");
    }

    if (request.status !== "pending") {
      throw new Error(`Request is already ${request.status}`);
    }

    await requirePermission(ctx, request.organizationId, "locations.update");

    await Promise.all([
      ctx.db.patch(args.requestId, {
        status: "approved",
        reviewedBy: userId,
        reviewedAt: Date.now(),
        reviewNotes: args.reviewNotes,
        capacityOverride: args.overrideCapacity,
        statusOverride: args.overrideStatus,
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: request.organizationId,
        userId,
        action: "approved_move_request",
        entityType: "collection",
        entityId: request.collectionId,
        changes: { requestId: args.requestId },
      }),
    ]);

    return null;
  },
});

/**
 * Reject a move request
 */
export const rejectMoveRequest = mutation({
  args: {
    requestId: v.id("locationMoveRequests"),
    reviewNotes: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, request] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.requestId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!request) {
      throw new Error("Move request not found");
    }

    if (request.status !== "pending") {
      throw new Error(`Request is already ${request.status}`);
    }

    await requirePermission(ctx, request.organizationId, "locations.update");

    await Promise.all([
      ctx.db.patch(args.requestId, {
        status: "rejected",
        reviewedBy: userId,
        reviewedAt: Date.now(),
        reviewNotes: args.reviewNotes,
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: request.organizationId,
        userId,
        action: "rejected_move_request",
        entityType: "collection",
        entityId: request.collectionId,
        changes: { requestId: args.requestId, reason: args.reviewNotes },
      }),
    ]);

    return null;
  },
});

/**
 * Execute an approved move request
 */
export const executeMoveRequest = mutation({
  args: {
    requestId: v.id("locationMoveRequests"),
    executionNotes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, request] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.requestId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!request) {
      throw new Error("Move request not found");
    }

    if (request.status !== "approved") {
      throw new Error("Move request must be approved before execution");
    }

    await requirePermission(ctx, request.organizationId, "locations.update");

    const collection = await ctx.db.get(request.collectionId);
    if (!collection) {
      throw new Error("Collection not found");
    }

    const toLocation = await ctx.db.get(request.toLocationId);
    if (!toLocation) {
      throw new Error("Target location not found");
    }

    // Check capacity (unless override approved)
    if (!request.capacityOverride && toLocation.capacity) {
      const objectsAtLocation = await ctx.db
        .query("collections")
        .withIndex("by_currentLocation", (q) =>
          q.eq("currentLocationId", request.toLocationId),
        )
        .collect();

      if (objectsAtLocation.length >= toLocation.capacity) {
        throw new Error("Target location is now at capacity");
      }
    }

    // Check status (unless override approved)
    const locationStatus = toLocation.status ?? "active";
    if (
      !request.statusOverride &&
      (!toLocation.isActive || locationStatus !== "active")
    ) {
      throw new Error(`Target location status is ${locationStatus}`);
    }

    // Execute the move
    const now = Date.now();
    await Promise.all([
      ctx.db.insert("locationHistory", {
        collectionId: request.collectionId,
        fromLocationId: request.fromLocationId,
        toLocationId: request.toLocationId,
        movedBy: userId,
        movedAt: now,
        reason: request.reason,
        notes: args.executionNotes,
      }),
      ctx.db.patch(request.collectionId, {
        currentLocationId: request.toLocationId,
        lastModifiedBy: userId,
        lastModifiedAt: now,
      }),
      ctx.db.patch(args.requestId, {
        status: "executed",
        executedBy: userId,
        executedAt: now,
        executionNotes: args.executionNotes,
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: request.organizationId,
        userId,
        action: "executed_move_request",
        entityType: "collection",
        entityId: request.collectionId,
        changes: {
          requestId: args.requestId,
          fromLocationId: request.fromLocationId,
          toLocationId: request.toLocationId,
        },
      }),
    ] as const);

    return null;
  },
});

/**
 * Cancel a move request
 */
export const cancelMoveRequest = mutation({
  args: {
    requestId: v.id("locationMoveRequests"),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, request] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.requestId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!request) {
      throw new Error("Move request not found");
    }

    if (request.status === "executed" || request.status === "cancelled") {
      throw new Error(`Cannot cancel ${request.status} request`);
    }

    await requirePermission(ctx, request.organizationId, "locations.update");

    await ctx.db.patch(args.requestId, {
      status: "cancelled",
      notes: args.reason
        ? `${request.notes || ""} Cancelled: ${args.reason}`
        : request.notes,
    });

    return null;
  },
});

/**
 * List move requests for an organization
 */
export const listMoveRequests = query({
  args: {
    organizationId: v.id("organizations"),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
        v.literal("executed"),
        v.literal("cancelled"),
      ),
    ),
  },
  returns: v.array(
    v.object({
      _id: v.id("locationMoveRequests"),
      collectionId: v.id("collections"),
      collectionTitle: v.string(),
      accessionNumber: v.string(),
      fromLocationId: v.optional(v.id("locations")),
      fromLocationName: v.optional(v.string()),
      toLocationId: v.id("locations"),
      toLocationName: v.string(),
      reason: v.string(),
      scheduledDate: v.optional(v.number()),
      priority: v.optional(v.string()),
      status: v.string(),
      requestedBy: v.id("users"),
      requestedByName: v.optional(v.string()),
      requestedAt: v.number(),
      reviewedByName: v.optional(v.string()),
      reviewedAt: v.optional(v.number()),
      reviewNotes: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "locations.read");

    const query = args.status
      ? ctx.db
          .query("locationMoveRequests")
          .withIndex("by_organization_and_status", (q) =>
            q
              .eq("organizationId", args.organizationId)
              .eq("status", args.status!),
          )
      : ctx.db
          .query("locationMoveRequests")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", args.organizationId),
          );

    const requests = await query.collect();

    const enriched = await Promise.all(
      requests.map(async (req) => {
        const collection = await ctx.db.get(req.collectionId);
        const fromLocation = req.fromLocationId
          ? await ctx.db.get(req.fromLocationId)
          : null;
        const [toLocation, requestedBy] = await Promise.all([
          ctx.db.get(req.toLocationId),
          ctx.db.get(req.requestedBy),
        ] as const);
        const reviewedBy = req.reviewedBy
          ? await ctx.db.get(req.reviewedBy)
          : null;

        return {
          _id: req._id,
          collectionId: req.collectionId,
          collectionTitle: collection?.title ?? "Unknown",
          accessionNumber: collection?.accessionNumber ?? "Unknown",
          fromLocationId: req.fromLocationId,
          fromLocationName: fromLocation?.name,
          toLocationId: req.toLocationId,
          toLocationName: toLocation?.name ?? "Unknown",
          reason: req.reason,
          scheduledDate: req.scheduledDate,
          priority: req.priority,
          status: req.status,
          requestedBy: req.requestedBy,
          requestedByName: requestedBy?.name ?? requestedBy?.username,
          requestedAt: req.requestedAt,
          reviewedByName: reviewedBy?.name ?? reviewedBy?.username,
          reviewedAt: req.reviewedAt,
          reviewNotes: req.reviewNotes,
        };
      }),
    );

    return enriched.sort((a, b) => b.requestedAt - a.requestedAt);
  },
});

/**
 * Get move request by ID
 */
export const getMoveRequest = query({
  args: {
    requestId: v.id("locationMoveRequests"),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      return null;
    }

    await requirePermission(ctx, request.organizationId, "locations.read");

    const collection = await ctx.db.get(request.collectionId);
    const fromLocation = request.fromLocationId
      ? await ctx.db.get(request.fromLocationId)
      : null;
    const [toLocation, requestedBy] = await Promise.all([
      ctx.db.get(request.toLocationId),
      ctx.db.get(request.requestedBy),
    ] as const);
    const reviewedBy = request.reviewedBy
      ? await ctx.db.get(request.reviewedBy)
      : null;
    const executedBy = request.executedBy
      ? await ctx.db.get(request.executedBy)
      : null;

    return {
      ...request,
      collection,
      fromLocation,
      toLocation,
      requestedByUser: requestedBy,
      reviewedByUser: reviewedBy,
      executedByUser: executedBy,
    };
  },
});

/**
 * Update location status
 */
export const updateStatus = mutation({
  args: {
    locationId: v.id("locations"),
    status: v.union(
      v.literal("active"),
      v.literal("closed"),
      v.literal("renovation"),
      v.literal("restricted"),
    ),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, location] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.locationId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!location) {
      throw new Error("Location not found");
    }

    await requirePermission(ctx, location.organizationId, "locations.update");

    // Check if there are objects at this location when closing
    if (args.status === "closed") {
      const objectsAtLocation = await ctx.db
        .query("collections")
        .withIndex("by_currentLocation", (q) =>
          q.eq("currentLocationId", args.locationId),
        )
        .first();

      if (objectsAtLocation) {
        throw new Error(
          "Cannot close location with objects. Move objects first.",
        );
      }
    }

    await Promise.all([
      ctx.db.patch(args.locationId, {
        status: args.status,
        isActive: args.status !== "closed",
        notes: args.notes ?? location.notes,
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: location.organizationId,
        userId,
        action: "updated_location_status",
        entityType: "location",
        entityId: args.locationId,
        changes: { status: args.status },
      }),
    ]);

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
      locationCode: v.string(),
      type: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const path: Array<{
      _id: Id<"locations">;
      name: string;
      locationCode: string;
      type: string;
    }> = [];

    let currentLocationId: Id<"locations"> | undefined = args.locationId;

    while (currentLocationId) {
      const location: {
        _id: Id<"locations">;
        organizationId: Id<"organizations">;
        name: string;
        locationCode?: string;
        type: string;
        parentLocationId?: Id<"locations">;
      } | null = await ctx.db.get(currentLocationId);
      if (!location) break;

      await requirePermission(ctx, location.organizationId, "locations.read");

      path.unshift({
        _id: location._id,
        name: location.name,
        locationCode: getLocationCodeValue(location),
        type: location.type,
      });

      currentLocationId = location.parentLocationId;
    }

    return path;
  },
});

/**
 * Reorder locations (update sortOrder for drag-and-drop)
 */
export const reorder = mutation({
  args: {
    locationId: v.id("locations"),
    newParentLocationId: v.optional(v.id("locations")),
    newSortOrder: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, location] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.locationId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!location) {
      throw new Error("Location not found");
    }

    // Check permission
    await requirePermission(ctx, location.organizationId, "locations.update");

    // Verify new parent location belongs to same organization
    if (args.newParentLocationId) {
      const newParent = await ctx.db.get(args.newParentLocationId);
      if (!newParent || newParent.organizationId !== location.organizationId) {
        throw new Error("Invalid parent location");
      }
      if (!newParent.isActive) {
        throw new Error("Parent location is not active");
      }

      // Prevent circular references
      if (args.newParentLocationId === args.locationId) {
        throw new Error("Cannot set location as its own parent");
      }

      // Check if creating a cycle
      let currentParentId: Id<"locations"> | undefined =
        args.newParentLocationId;
      while (currentParentId) {
        if (currentParentId === args.locationId) {
          throw new Error("Cannot create circular location hierarchy");
        }
        const currentParent: { parentLocationId?: Id<"locations"> } | null =
          await ctx.db.get(currentParentId);
        currentParentId = currentParent?.parentLocationId;
      }
    }

    const oldParentId = location.parentLocationId;
    const newParentId = args.newParentLocationId;

    // Get all siblings in the new parent
    const newSiblings = await ctx.db
      .query("locations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", location.organizationId),
      )
      .filter((q) => {
        if (newParentId) {
          return q.eq(q.field("parentLocationId"), newParentId);
        }
        return q.eq(q.field("parentLocationId"), undefined);
      })
      .collect();

    // Sort siblings by current sortOrder
    const sortedSiblings = newSiblings
      .filter((loc) => loc._id !== args.locationId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    // Insert the moved location at the new position
    sortedSiblings.splice(args.newSortOrder, 0, location);

    await Promise.all(
      sortedSiblings.map((sibling, i) => {
        if (!sibling) {
          return Promise.resolve();
        }

        if (sibling._id === args.locationId) {
          return ctx.db.patch(args.locationId, {
            parentLocationId: newParentId,
            sortOrder: i,
          });
        }

        if (sibling.sortOrder !== i) {
          return ctx.db.patch(sibling._id, {
            sortOrder: i,
          });
        }

        return Promise.resolve();
      }),
    );

    // If parent changed, re-normalize sortOrder in old parent
    if (oldParentId !== newParentId) {
      const oldSiblings = await ctx.db
        .query("locations")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", location.organizationId),
        )
        .filter((q) => {
          if (oldParentId) {
            return q.eq(q.field("parentLocationId"), oldParentId);
          }
          return q.eq(q.field("parentLocationId"), undefined);
        })
        .collect();

      const sortedOldSiblings = oldSiblings.sort(
        (a, b) => a.sortOrder - b.sortOrder,
      );

      // Re-index old siblings
      await Promise.all(
        Array.from({ length: sortedOldSiblings.length }, async (_, i) => {
          const sibling = sortedOldSiblings[i];
          if (sibling && sibling.sortOrder !== i) {
            await ctx.db.patch(sibling._id, {
              sortOrder: i,
            });
          }
        }),
      );
    }
  },
});

/**
 * Get all objects at a location
 */
export const getObjectsAtLocation = query({
  args: {
    locationId: v.id("locations"),
    includeDescendants: v.optional(v.boolean()),
  },
  returns: v.array(
    v.object({
      _id: v.id("collections"),
      currentLocationId: v.id("locations"),
      accessionNumber: v.string(),
      title: v.string(),
      status: v.union(
        v.literal("active"),
        v.literal("loaned"),
        v.literal("deaccessioned"),
        v.literal("archived"),
        v.literal("deleted"),
      ),
      thumbnailUrl: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const location = await ctx.db.get(args.locationId);
    if (!location) {
      throw new Error("Location not found");
    }

    await requirePermission(ctx, location.organizationId, "locations.read");

    const locationIds = new Set<Id<"locations">>([args.locationId]);

    if (args.includeDescendants) {
      const visitedLocationIds = new Set<Id<"locations">>([args.locationId]);
      const pendingLocationIds: Id<"locations">[] = [args.locationId];

      const collectDescendantLocations = async (
        waveIds: Id<"locations">[],
      ): Promise<void> => {
        if (waveIds.length === 0) {
          return;
        }

        const childrenByParent = await Promise.all(
          waveIds.map((parentId) =>
            ctx.db
              .query("locations")
              .withIndex("by_parentLocation", (q) =>
                q.eq("parentLocationId", parentId),
              )
              .collect(),
          ),
        );

        const nextWaveIds: Id<"locations">[] = [];
        for (const children of childrenByParent) {
          for (const child of children) {
            if (
              !child.isActive ||
              child.organizationId !== location.organizationId ||
              visitedLocationIds.has(child._id)
            ) {
              continue;
            }

            visitedLocationIds.add(child._id);
            locationIds.add(child._id);
            nextWaveIds.push(child._id);
          }
        }

        await collectDescendantLocations(nextWaveIds);
      };

      await collectDescendantLocations(pendingLocationIds);
    }

    const objectsById = new Map<
      Id<"collections">,
      {
        _id: Id<"collections">;
        currentLocationId: Id<"locations">;
        accessionNumber: string;
        title: string;
        status: "active" | "loaned" | "deaccessioned" | "archived" | "deleted";
      }
    >();

    await Promise.all(
      Array.from(locationIds).map(async (locationId) => {
        const objects = await ctx.db
          .query("collections")
          .withIndex("by_currentLocation", (q) =>
            q.eq("currentLocationId", locationId),
          )
          .collect();

        for (const object of objects) {
          objectsById.set(object._id, {
            _id: object._id,
            currentLocationId: locationId,
            accessionNumber: object.accessionNumber,
            title: object.title,
            status: object.status,
          });
        }
      }),
    );

    const sortedObjects = Array.from(objectsById.values()).sort(
      (left, right) => {
        const accessionComparison = left.accessionNumber.localeCompare(
          right.accessionNumber,
          undefined,
          { numeric: true, sensitivity: "base" },
        );
        if (accessionComparison !== 0) {
          return accessionComparison;
        }

        const titleComparison = left.title.localeCompare(
          right.title,
          undefined,
          {
            sensitivity: "base",
          },
        );
        if (titleComparison !== 0) {
          return titleComparison;
        }

        return left._id.localeCompare(right._id);
      },
    );

    const canReadMedia = await hasPermission(
      ctx,
      location.organizationId,
      "media.read",
    );

    if (!canReadMedia) {
      return sortedObjects.map((object) => ({
        ...object,
        thumbnailUrl: null,
      }));
    }

    return await Promise.all(
      sortedObjects.map(async (object) => {
        const primaryMedia = await ctx.db
          .query("mediaFiles")
          .withIndex("by_collection", (q) => q.eq("collectionId", object._id))
          .filter((q) => q.eq(q.field("isPrimary"), true))
          .first();

        let thumbnailUrl: string | null = null;

        if (primaryMedia?.thumbnailStorageId) {
          thumbnailUrl =
            (await ctx.storage.getUrl(primaryMedia.thumbnailStorageId)) ?? null;
        } else if (primaryMedia?.fileType === "image") {
          thumbnailUrl =
            (await ctx.storage.getUrl(primaryMedia.storageId)) ?? null;
        }

        return {
          ...object,
          thumbnailUrl,
        };
      }),
    );
  },
});

/**
 * Get all locations with their full paths for hierarchical selector
 */
export const listAllWithPaths = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("locations"),
      name: v.string(),
      locationCode: v.string(),
      type: v.string(),
      path: v.array(
        v.object({
          _id: v.id("locations"),
          name: v.string(),
          locationCode: v.string(),
          type: v.string(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const [, allLocations] = await Promise.all([
      requirePermission(ctx, args.organizationId, "locations.read"),
      ctx.db
        .query("locations")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect(),
    ] as const);

    // Build a map of location ID to location for quick lookup
    const locationMap = new Map(allLocations.map((loc) => [loc._id, loc]));

    // Helper function to build path for a location
    function buildPath(locationId: Id<"locations">): Array<{
      _id: Id<"locations">;
      name: string;
      locationCode: string;
      type: string;
    }> {
      const path: Array<{
        _id: Id<"locations">;
        name: string;
        locationCode: string;
        type: string;
      }> = [];
      let currentId: Id<"locations"> | undefined = locationId;

      while (currentId) {
        const location = locationMap.get(currentId);
        if (!location) break;

        path.unshift({
          _id: location._id,
          name: location.name,
          locationCode: getLocationCodeValue(location),
          type: location.type,
        });

        currentId = location.parentLocationId;
      }

      return path;
    }

    // Build result with paths
    return allLocations.map((location) => ({
      _id: location._id,
      name: location.name,
      locationCode: getLocationCodeValue(location),
      type: location.type,
      path: buildPath(location._id),
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
    await requirePermission(ctx, args.organizationId, "locations.read");

    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new Error("Organization not found");
    }

    // Return custom types if configured, otherwise default types
    if (org.settings?.locationTypes && org.settings.locationTypes.length > 0) {
      return org.settings.locationTypes;
    }

    return ["building", "floor", "room", "cabinet", "shelf", "box", "storage"];
  },
});

/**
 * Get location history for a location (items moved in/out)
 */
export const getLocationHistory = query({
  args: {
    locationId: v.id("locations"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      id: v.string(),
      collectionId: v.id("collections"),
      collectionTitle: v.string(),
      accessionNumber: v.string(),
      eventType: v.union(v.literal("moved_in"), v.literal("moved_out")),
      timestamp: v.number(),
      movedByName: v.optional(v.string()),
      otherLocationName: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const location = await ctx.db.get(args.locationId);
    if (!location) {
      throw new Error("Location not found");
    }

    await requirePermission(ctx, location.organizationId, "locations.read");

    const limit = args.limit ?? 50;

    const [movedIn, movedOut] = await Promise.all([
      ctx.db
        .query("locationHistory")
        .withIndex("by_toLocation_and_movedAt", (q) =>
          q.eq("toLocationId", args.locationId),
        )
        .order("desc")
        .take(limit),
      ctx.db
        .query("locationHistory")
        .withIndex("by_fromLocation_and_movedAt", (q) =>
          q.eq("fromLocationId", args.locationId),
        )
        .order("desc")
        .take(limit),
    ] as const);
    const allEvents = [...movedIn, ...movedOut];

    const enrichedEvents = await Promise.all(
      allEvents.map(async (event) => {
        const collection = await ctx.db.get(event.collectionId);
        if (!collection) return null;

        const movedBy = await ctx.db.get(event.movedBy);
        const isMovedIn = event.toLocationId === args.locationId;
        const otherLocationId = isMovedIn
          ? event.fromLocationId
          : event.toLocationId;
        const otherLocation = otherLocationId
          ? await ctx.db.get(otherLocationId)
          : null;

        return {
          id: event._id,
          collectionId: event.collectionId,
          collectionTitle: collection.title,
          accessionNumber: collection.accessionNumber,
          eventType: isMovedIn ? ("moved_in" as const) : ("moved_out" as const),
          timestamp: event.movedAt,
          movedByName: movedBy?.name || movedBy?.username,
          otherLocationName: otherLocation?.name,
        };
      }),
    );

    const validEvents = enrichedEvents.filter(
      (e): e is NonNullable<typeof e> => e !== null,
    );
    validEvents.sort((a, b) => b.timestamp - a.timestamp);

    return validEvents.slice(0, limit);
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

    const [, history] = await Promise.all([
      requirePermission(ctx, collection.organizationId, "collections.read"),
      ctx.db
        .query("locationHistory")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", args.collectionId),
        )
        .order("desc")
        .collect(),
    ] as const);

    const enrichedHistory = await Promise.all(
      history.map(async (entry) => {
        const fromLocation = entry.fromLocationId
          ? await ctx.db.get(entry.fromLocationId)
          : null;
        const [toLocation, movedBy] = await Promise.all([
          ctx.db.get(entry.toLocationId),
          ctx.db.get(entry.movedBy),
        ] as const);
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

// Realistic museum location data with environmental monitoring
const LOCATIONS_DATA: Record<
  string,
  Array<{
    name: string;
    type: string;
    parentLocationId?: string;
    notes?: string;
    customFields?: LocationCustomFields;
    isSecure?: boolean;
    temperature?: number;
    humidity?: number;
  }>
> = {
  "natural-history-museum": [
    {
      name: "Main Hall",
      type: "hall",
      notes:
        "Primary exhibition space with high ceilings and natural skylighting",
      temperature: 21,
      humidity: 45,
    },
    {
      name: "Gallery 3: Antiquities",
      type: "gallery",
      parentLocationId: "Main Hall",
      notes: "Ancient artifacts from Mediterranean civilizations",
      temperature: 20,
      humidity: 40,
    },
    {
      name: "East Wing",
      type: "wing",
      temperature: 21,
      humidity: 50,
    },
    {
      name: "Dinosaur Hall",
      type: "gallery",
      parentLocationId: "East Wing",
      notes: "Jurassic and Cretaceous dinosaur exhibits",
      temperature: 19,
      humidity: 55,
    },
    {
      name: "Fossil Gallery",
      type: "gallery",
      parentLocationId: "East Wing",
      notes: "Prehistoric life and fossil exhibits",
      temperature: 18,
      humidity: 50,
    },
    {
      name: "Mineral Room",
      type: "room",
      parentLocationId: "East Wing",
      notes: "Gem and mineral collection",
      temperature: 18,
      humidity: 35,
    },
    {
      name: "Vault A",
      type: "vault",
      notes: "High-value specimens and precious gems",
      isSecure: true,
      temperature: 18,
      humidity: 40,
    },
    {
      name: "Vault B",
      type: "vault",
      isSecure: true,
      temperature: 18,
      humidity: 40,
    },
    {
      name: "Cold Storage",
      type: "storage",
      notes: "Low-temperature storage for sensitive specimens",
      temperature: 4,
      humidity: 35,
    },
    {
      name: "Archive Room",
      type: "storage",
      notes: "Document archives and historical records",
      temperature: 18,
      humidity: 45,
    },
    {
      name: "Cabinet A1",
      type: "cabinet",
      parentLocationId: "Archive Room",
      notes: "Paleontology field notes",
    },
    {
      name: "Cabinet A2",
      type: "cabinet",
      parentLocationId: "Archive Room",
      notes: "Photographic collection",
    },
  ],
  "metropolitan-art-gallery": [
    {
      name: "Grand Gallery",
      type: "gallery",
      notes: "Main exhibition space with skylight",
      temperature: 21,
      humidity: 45,
    },
    {
      name: "Renaissance Wing",
      type: "wing",
      temperature: 21,
      humidity: 50,
    },
    {
      name: "Room 1",
      type: "room",
      parentLocationId: "Renaissance Wing",
      notes: "Early Renaissance paintings",
    },
    {
      name: "Room 2",
      type: "room",
      parentLocationId: "Renaissance Wing",
      notes: "High Renaissance masterpieces",
    },
    {
      name: "Modern Wing",
      type: "wing",
      temperature: 22,
      humidity: 45,
    },
    {
      name: "Impressionist Gallery",
      type: "gallery",
      parentLocationId: "Modern Wing",
      notes: "19th century French paintings",
      temperature: 21,
      humidity: 48,
    },
    {
      name: "Contemporary Gallery",
      type: "gallery",
      parentLocationId: "Modern Wing",
      notes: "20th-21st century contemporary art",
      temperature: 21,
      humidity: 45,
    },
    {
      name: "Main Vault",
      type: "vault",
      notes: "Primary secure storage for high-value artworks",
      isSecure: true,
      temperature: 18,
      humidity: 45,
    },
    {
      name: "Climate-Controlled Storage",
      type: "storage",
      notes: "Long-term art storage",
      temperature: 18,
      humidity: 45,
    },
    {
      name: "Crate Storage",
      type: "storage",
      notes: "Packed artworks awaiting exhibition",
      temperature: 18,
      humidity: 50,
    },
    {
      name: "Framing Workshop",
      type: "workshop",
      notes: "Conservation and framing facilities",
      temperature: 20,
      humidity: 50,
    },
  ],
  "heritage-library": [
    {
      name: "Reading Room",
      type: "room",
      notes: "Public reading room with original manuscripts display",
      temperature: 21,
      humidity: 45,
    },
    {
      name: "Exhibition Hall",
      type: "hall",
      notes: "Rotating exhibitions",
      temperature: 20,
      humidity: 50,
    },
    {
      name: "Rotunda",
      type: "room",
      parentLocationId: "Reading Room",
      notes: "Central space with domed ceiling",
    },
    {
      name: "Rare Books Vault",
      type: "vault",
      notes: "Climate-controlled rare book storage",
      isSecure: true,
      temperature: 16,
      humidity: 45,
    },
    {
      name: "Manuscript Room",
      type: "room",
      parentLocationId: "Rare Books Vault",
      notes: "Special collection manuscripts",
      temperature: 16,
      humidity: 40,
    },
    {
      name: "Document Archive",
      type: "storage",
      notes: "Historical documents and records",
      temperature: 18,
      humidity: 45,
    },
    {
      name: "Microfilm Room",
      type: "room",
      notes: "Microfilm and microfiche collection",
    },
    {
      name: "Cold Storage Vault",
      type: "vault",
      notes: "Cold storage for sensitive materials",
      isSecure: true,
      temperature: 4,
      humidity: 35,
    },
  ],
  "contemporary-design": [
    {
      name: "Main Gallery",
      type: "gallery",
      notes: "Primary exhibition space",
      temperature: 21,
      humidity: 45,
    },
    {
      name: "Design Lab",
      type: "room",
      notes: "Interactive design exhibits",
    },
    {
      name: "Furniture Gallery",
      type: "gallery",
      notes: "Furniture and industrial design",
      temperature: 21,
      humidity: 45,
    },
    {
      name: "Product Design Gallery",
      type: "gallery",
      notes: "Consumer product design exhibits",
    },
    {
      name: "Design Archive",
      type: "storage",
      notes: "Design archives and prototypes",
      temperature: 18,
      humidity: 45,
    },
    {
      name: "Vault",
      type: "vault",
      notes: "Valuable prototypes and limited editions",
      isSecure: true,
      temperature: 18,
      humidity: 45,
    },
  ],
  "vanderbilt-collection": [
    {
      name: "Grand Foyer",
      type: "room",
      notes: "Main entrance hall",
      temperature: 21,
      humidity: 45,
    },
    {
      name: "East Gallery",
      type: "gallery",
      notes: "European paintings",
      temperature: 21,
      humidity: 50,
    },
    {
      name: "West Gallery",
      type: "gallery",
      notes: "American art collection",
      temperature: 21,
      humidity: 50,
    },
    {
      name: "Jewelry Room",
      type: "room",
      notes: "Decorative arts and jewelry",
      isSecure: true,
      temperature: 20,
      humidity: 40,
    },
    {
      name: "Private Vault",
      type: "vault",
      notes: "Maximum security storage",
      isSecure: true,
      temperature: 18,
      humidity: 45,
    },
    {
      name: "Climate Storage",
      type: "storage",
      notes: "Climate-controlled collection storage",
      temperature: 18,
      humidity: 45,
    },
  ],
};

// Helper to build location hierarchy for seed
async function buildLocationHierarchy(
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  locations: (typeof LOCATIONS_DATA)[string],
) {
  const nameToId: Record<string, Id<"locations">> = {};
  let locationIndex = 1;

  await Promise.all(
    Array.from(locations).map(async (loc) => {
      const locationCode = `LOC-${String(locationIndex).padStart(3, "0")}`;
      const locationId = await ctx.db.insert("locations", {
        organizationId: orgId,
        name: loc.name,
        locationCode,
        locationCodeNormalized: locationCode.toLowerCase(),
        type: loc.type,
        sortOrder: 0,
        isActive: true,
        notes: loc.notes,
        customFields: loc.customFields ?? {
          ...(loc.temperature !== undefined && {
            temperature: loc.temperature,
          }),
          ...(loc.humidity !== undefined && { humidity: loc.humidity }),
          ...(loc.isSecure !== undefined && { isSecure: loc.isSecure }),
        },
      });
      nameToId[loc.name] = locationId;
      locationIndex++;
    }),
  );

  await Promise.all(
    Array.from(locations).map(async (loc) => {
      if (loc.parentLocationId) {
        const parentId = nameToId[loc.parentLocationId];
        const childId = nameToId[loc.name];
        if (parentId && childId) {
          await ctx.db.patch(childId, {
            parentLocationId: parentId,
          });
        }
      }
    }),
  );

  return nameToId;
}

/**
 * Seed locations for a specific organization
 */
export const seedLocationsForOrg = internalMutation({
  args: {
    organizationSlug: v.string(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.organizationSlug))
      .first();

    if (!org) {
      throw new Error(`Organization not found: ${args.organizationSlug}`);
    }

    const locations = LOCATIONS_DATA[args.organizationSlug];
    if (!locations) {
      throw new Error(
        `No location data for organization: ${args.organizationSlug}`,
      );
    }

    const existingLocations = await ctx.db
      .query("locations")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    await Promise.all(
      Array.from(existingLocations).map((loc) =>
        ctx.db.patch(loc._id, { isActive: false }),
      ),
    );

    await buildLocationHierarchy(ctx, org._id, locations);

    return locations.length;
  },
});

/**
 * Seed all locations for all demo organizations
 */
export const seedAllLocations = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    let totalLocations = 0;

    await Promise.all(
      Array.from(Object.keys(LOCATIONS_DATA)).map(async (orgSlug) => {
        const count = await ctx.runMutation(
          internal.locations.seedLocationsForOrg,
          {
            organizationSlug: orgSlug,
          },
        );
        totalLocations += count;
      }),
    );

    return totalLocations;
  },
});

/**
 * Get all locations with their environmental data
 */
export const getLocationsWithEnvironment = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("locations"),
      name: v.string(),
      type: v.string(),
      parentLocationId: v.optional(v.id("locations")),
      sortOrder: v.number(),
      isActive: v.boolean(),
      notes: v.optional(v.string()),
      customFields: v.optional(v.record(v.string(), customFieldValue)),
    }),
  ),
  handler: async (ctx, args) => {
    const locations = await ctx.db
      .query("locations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    return locations.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

/**
 * Seed all locations - internal only, triggered via dashboard or CLI
 */
export const adminSeedAllLocations = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx): Promise<number> => {
    let totalLocations = 0;
    await Promise.all(
      Array.from(Object.keys(LOCATIONS_DATA)).map(async (orgSlug) => {
        const count = await ctx.runMutation(
          internal.locations.seedLocationsForOrg,
          {
            organizationSlug: orgSlug,
          },
        );
        totalLocations += count;
      }),
    );
    return totalLocations;
  },
});
