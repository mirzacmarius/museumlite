import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalQuery, mutation, query } from "./_generated/server";
import { requireModuleEnabled } from "./utils/featureGates";
import { requirePermission } from "./utils/permissions";

const documentTypeValidator = v.union(
  v.literal("contract"),
  v.literal("agreement"),
  v.literal("invoice"),
  v.literal("correspondence"),
  v.literal("other"),
);

/**
 * List all documents for an account
 */
export const list = query({
  args: {
    accountId: v.id("accounts"),
  },
  returns: v.array(
    v.object({
      _id: v.id("accountDocuments"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      accountId: v.id("accounts"),
      storageId: v.id("_storage"),
      filename: v.string(),
      mimeType: v.string(),
      size: v.number(),
      documentType: documentTypeValidator,
      description: v.optional(v.string()),
      uploadedBy: v.id("users"),
      uploadedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) {
      throw new Error("Account not found");
    }

    await requireModuleEnabled(ctx, account.organizationId, "accounts");
    await requirePermission(ctx, account.organizationId, "accounts.read");

    const documents = await ctx.db
      .query("accountDocuments")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .collect();

    return documents;
  },
});

/**
 * Get a single document with download URL
 */
export const get = query({
  args: {
    documentId: v.id("accountDocuments"),
  },
  returns: v.union(
    v.object({
      _id: v.id("accountDocuments"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      accountId: v.id("accounts"),
      storageId: v.id("_storage"),
      filename: v.string(),
      mimeType: v.string(),
      size: v.number(),
      documentType: documentTypeValidator,
      description: v.optional(v.string()),
      uploadedBy: v.id("users"),
      uploadedAt: v.number(),
      downloadUrl: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      return null;
    }

    const account = await ctx.db.get(document.accountId);
    if (!account) {
      return null;
    }

    await requireModuleEnabled(ctx, account.organizationId, "accounts");
    await requirePermission(ctx, account.organizationId, "accounts.read");

    const downloadUrl = await ctx.storage.getUrl(document.storageId);

    return {
      ...document,
      downloadUrl,
    };
  },
});

/**
 * Create a new document record (after file upload)
 */
export const create = mutation({
  args: {
    accountId: v.id("accounts"),
    storageId: v.id("_storage"),
    filename: v.string(),
    mimeType: v.string(),
    size: v.number(),
    documentType: documentTypeValidator,
    description: v.optional(v.string()),
  },
  returns: v.id("accountDocuments"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const account = await ctx.db.get(args.accountId);
    if (!account) {
      throw new Error("Account not found");
    }

    await requireModuleEnabled(ctx, account.organizationId, "accounts");
    await requirePermission(ctx, account.organizationId, "accounts.write");

    const documentId = await ctx.db.insert("accountDocuments", {
      organizationId: account.organizationId,
      accountId: args.accountId,
      storageId: args.storageId,
      filename: args.filename.trim(),
      mimeType: args.mimeType,
      size: args.size,
      documentType: args.documentType,
      description: args.description?.trim(),
      uploadedBy: userId,
      uploadedAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: account.organizationId,
      userId,
      action: "uploaded_account_document",
      entityType: "accountDocument",
      entityId: documentId,
      changes: {
        filename: args.filename.trim(),
        documentType: args.documentType,
        accountId: args.accountId,
      },
    });

    return documentId;
  },
});

export const remove = mutation({
  args: {
    documentId: v.id("accountDocuments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    const account = await ctx.db.get(document.accountId);
    if (!account) {
      throw new Error("Account not found");
    }

    await requireModuleEnabled(ctx, account.organizationId, "accounts");
    await requirePermission(ctx, account.organizationId, "accounts.delete");

    await ctx.db.delete(args.documentId);

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: account.organizationId,
      userId,
      action: "deleted_account_document",
      entityType: "accountDocument",
      entityId: args.documentId,
      changes: {
        filename: document.filename,
        accountId: document.accountId,
      },
    });

    return null;
  },
});

export const generateUploadUrl = action({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const uploadUrl = await ctx.storage.generateUploadUrl();

    return uploadUrl;
  },
});
