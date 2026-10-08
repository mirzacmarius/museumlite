import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { query } from "./_generated/server";
import { requireAccountAdministration } from "./utils/accountAdministration";
import { assertMuseumEvidenceDeletionAllowed } from "./utils/evidenceRetention";
import { mutation } from "./utils/mutationBuilders";
import { requireModuleAndPermission } from "./utils/permissions";
import {
  claimStorageOwnership,
  createAuthorizedUploadUrl,
} from "./utils/uploadOwnership";

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
    const [, documents] = await Promise.all([
      requireModuleAndPermission(
        ctx,
        account.organizationId,
        "accounts",
        "accounts.read",
      ),
      ctx.db
        .query("accountDocuments")
        .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
        .collect(),
    ] as const);

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

    const [account, downloadUrl] = await Promise.all([
      ctx.db.get(document.accountId),
      ctx.storage.getUrl(document.storageId),
      requireModuleAndPermission(
        ctx,
        document.organizationId,
        "accounts",
        "accounts.read",
      ),
    ] as const);
    if (!account) {
      return null;
    }

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
    const [userId, account] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.accountId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!account) {
      throw new Error("Account not found");
    }
    await requireAccountAdministration(ctx, account);
    await requireModuleAndPermission(
      ctx,
      account.organizationId,
      "accounts",
      "accounts.write",
    );

    return await ctx.db
      .insert("accountDocuments", {
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
      })
      .then(async (documentId) => {
        await claimStorageOwnership(ctx, {
          storageId: args.storageId,
          organizationId: account.organizationId,
          uploadedBy: userId,
          ownerType: "accountDocument",
          ownerId: documentId,
          expectedFileSize: args.size,
          expectedMimeType: args.mimeType,
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
      });
  },
});

export const remove = mutation({
  args: {
    documentId: v.id("accountDocuments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, document, account] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.documentId),
      ctx.db.get(args.documentId).then(async (doc) => {
        if (!doc) {
          return null;
        }
        return ctx.db.get(doc.accountId);
      }),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!document) {
      throw new Error("Document not found");
    }
    if (!account) {
      throw new Error("Account not found");
    }
    await requireAccountAdministration(ctx, account);
    await requireModuleAndPermission(
      ctx,
      account.organizationId,
      "accounts",
      "accounts.delete",
    );
    await assertMuseumEvidenceDeletionAllowed(ctx, account.organizationId);
    await Promise.all([
      ctx.db.delete(args.documentId),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: account.organizationId,
        userId,
        action: "deleted_account_document",
        entityType: "accountDocument",
        entityId: args.documentId,
        changes: {
          filename: document.filename,
          accountId: document.accountId,
        },
      }),
    ] as const);

    return null;
  },
});

export const generateUploadUrl = mutation({
  args: { accountId: v.id("accounts") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const account = await ctx.db.get(args.accountId);
    if (!account) throw new Error("Account not found");
    await requireAccountAdministration(ctx, account);
    await requireModuleAndPermission(
      ctx,
      account.organizationId,
      "accounts",
      "accounts.write",
    );
    return await createAuthorizedUploadUrl(ctx, userId, account.organizationId);
  },
});
