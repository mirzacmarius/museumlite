import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import QRCode from "qrcode";
import { mutation, query } from "./_generated/server";
import { env } from "./env";
import { requirePermission } from "./utils/permissions";

/**
 * Generate QR code for a collection object
 * Returns a data URL that can be used in img src or for printing
 */
export const generateQRCode = query({
  args: {
    organizationId: v.id("organizations"),
    collectionId: v.id("collections"),
    options: v.optional(
      v.object({
        width: v.optional(v.number()),
        margin: v.optional(v.number()),
        errorCorrectionLevel: v.optional(
          v.union(
            v.literal("L"),
            v.literal("M"),
            v.literal("Q"),
            v.literal("H"),
          ),
        ),
      }),
    ),
  },
  returns: v.object({
    dataUrl: v.string(),
    url: v.string(),
    accessionNumber: v.string(),
    title: v.string(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check permission
    await requirePermission(ctx, args.organizationId, "collections.read");

    // Get the collection object
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      throw new Error("Collection object not found");
    }

    // Verify the collection belongs to the organization
    if (collection.organizationId !== args.organizationId) {
      throw new Error("Collection does not belong to organization");
    }

    // Get organization to get slug
    const organization = await ctx.db.get(args.organizationId);
    if (!organization) {
      throw new Error("Organization not found");
    }

    // Construct the URL to the object detail page
    const baseUrl = env.SITE_URL;
    const objectUrl = `${baseUrl}/${organization.slug}/objects/${args.collectionId}`;

    // Generate QR code with options
    const qrOptions = {
      width: args.options?.width || 300,
      margin: args.options?.margin || 2,
      errorCorrectionLevel: args.options?.errorCorrectionLevel || "M",
    };

    try {
      const dataUrl = await QRCode.toDataURL(objectUrl, qrOptions);

      return {
        dataUrl,
        url: objectUrl,
        accessionNumber: collection.accessionNumber,
        title: collection.title,
      };
    } catch (error) {
      throw new Error(
        `Failed to generate QR code: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  },
});

/**
 * Generate QR code for a collection object by accession number
 * Useful for lookup scenarios where you have the accession number but not the ID
 */
export const generateQRCodeByAccessionNumber = query({
  args: {
    organizationId: v.id("organizations"),
    accessionNumber: v.string(),
    options: v.optional(
      v.object({
        width: v.optional(v.number()),
        margin: v.optional(v.number()),
        errorCorrectionLevel: v.optional(
          v.union(
            v.literal("L"),
            v.literal("M"),
            v.literal("Q"),
            v.literal("H"),
          ),
        ),
      }),
    ),
  },
  returns: v.object({
    dataUrl: v.string(),
    url: v.string(),
    accessionNumber: v.string(),
    title: v.string(),
    collectionId: v.id("collections"),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check permission
    await requirePermission(ctx, args.organizationId, "collections.read");

    // Find the collection by accession number
    const collection = await ctx.db
      .query("collections")
      .withIndex("by_organization_and_accessionNumber", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("accessionNumber", args.accessionNumber),
      )
      .first();

    if (!collection) {
      throw new Error(
        `Collection with accession number "${args.accessionNumber}" not found`,
      );
    }

    // Get organization to get slug
    const organization = await ctx.db.get(args.organizationId);
    if (!organization) {
      throw new Error("Organization not found");
    }

    // Construct the URL to the object detail page
    const baseUrl = env.SITE_URL;
    const objectUrl = `${baseUrl}/${organization.slug}/objects/${collection._id}`;

    // Generate QR code with options
    const qrOptions = {
      width: args.options?.width || 300,
      margin: args.options?.margin || 2,
      errorCorrectionLevel: args.options?.errorCorrectionLevel || "M",
    };

    try {
      const dataUrl = await QRCode.toDataURL(objectUrl, qrOptions);

      return {
        dataUrl,
        url: objectUrl,
        accessionNumber: collection.accessionNumber,
        title: collection.title,
        collectionId: collection._id,
      };
    } catch (error) {
      throw new Error(
        `Failed to generate QR code: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  },
});

/**
 * Generate QR codes for multiple collection objects
 * Returns an array of QR code data for batch printing or export
 */
export const generateBatchQRCodes = mutation({
  args: {
    organizationId: v.id("organizations"),
    collectionIds: v.array(v.id("collections")),
    options: v.optional(
      v.object({
        width: v.optional(v.number()),
        margin: v.optional(v.number()),
        errorCorrectionLevel: v.optional(
          v.union(
            v.literal("L"),
            v.literal("M"),
            v.literal("Q"),
            v.literal("H"),
          ),
        ),
      }),
    ),
  },
  returns: v.array(
    v.object({
      collectionId: v.id("collections"),
      dataUrl: v.union(v.string(), v.null()),
      url: v.string(),
      accessionNumber: v.string(),
      title: v.string(),
      error: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    if (args.collectionIds.length === 0) {
      throw new Error("No collections selected");
    }

    if (args.collectionIds.length > 1000) {
      throw new Error("Maximum 1000 items per batch operation");
    }

    await requirePermission(ctx, args.organizationId, "collections.read");

    // Get organization for slug
    const organization = await ctx.db.get(args.organizationId);
    if (!organization) {
      throw new Error("Organization not found");
    }

    const baseUrl = env.SITE_URL;

    // Generate QR code options once
    const qrOptions = {
      width: args.options?.width || 300,
      margin: args.options?.margin || 2,
      errorCorrectionLevel: args.options?.errorCorrectionLevel || "M",
    };

    // Process each collection
    const results = await Promise.all(
      args.collectionIds.map(async (collectionId) => {
        try {
          // Get the collection object
          const collection = await ctx.db.get(collectionId);
          if (!collection) {
            return {
              collectionId,
              dataUrl: null,
              url: "",
              accessionNumber: "",
              title: "",
              error: "Collection object not found",
            };
          }

          // Verify the collection belongs to the organization
          if (collection.organizationId !== args.organizationId) {
            return {
              collectionId,
              dataUrl: null,
              url: "",
              accessionNumber: collection.accessionNumber,
              title: collection.title,
              error: "Collection does not belong to organization",
            };
          }

          // Construct the URL to the object detail page
          const objectUrl = `${baseUrl}/${organization.slug}/objects/${collectionId}`;

          // Generate QR code
          try {
            const dataUrl = await QRCode.toDataURL(objectUrl, qrOptions);

            return {
              collectionId,
              dataUrl,
              url: objectUrl,
              accessionNumber: collection.accessionNumber,
              title: collection.title,
            };
          } catch (qrError) {
            return {
              collectionId,
              dataUrl: null,
              url: objectUrl,
              accessionNumber: collection.accessionNumber,
              title: collection.title,
              error: `Failed to generate QR code: ${qrError instanceof Error ? qrError.message : "Unknown error"}`,
            };
          }
        } catch (error) {
          return {
            collectionId,
            dataUrl: null,
            url: "",
            accessionNumber: "",
            title: "",
            error: `Error processing collection: ${error instanceof Error ? error.message : "Unknown error"}`,
          };
        }
      }),
    );

    return results;
  },
});
