import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { rejectPermanentEvidenceDeletion } from "./evidenceRetention";
import { requireExhibitionAccess } from "./exhibitionAccess";
import { requirePermission } from "./permissions";

export async function listExhibitionDocumentsHandler(
  ctx: QueryCtx,
  args: { exhibitionId: Id<"exhibitions"> },
) {
  const exhibition = await ctx.db.get(args.exhibitionId);
  if (!exhibition) {
    return [];
  }
  await Promise.all([
    requireExhibitionAccess(ctx, exhibition.organizationId),
    requirePermission(ctx, exhibition.organizationId, "collections.read"),
  ]);
  const documents = await ctx.db
    .query("exhibitionDocuments")
    .withIndex("by_exhibition", (q) => q.eq("exhibitionId", args.exhibitionId))
    .collect();

  const enrichedDocs = await Promise.all(
    documents.map(async (doc) => {
      const [uploader, url] = await Promise.all([
        ctx.db.get(doc.uploadedBy),
        ctx.storage.getUrl(doc.storageId),
      ] as const);
      return {
        _id: doc._id,
        storageId: doc.storageId,
        documentType: doc.documentType,
        fileName: doc.fileName,
        uploadedBy: doc.uploadedBy,
        uploadedAt: doc.uploadedAt,
        uploaderName: uploader?.name ?? uploader?.username ?? undefined,
        url: url ?? undefined,
      };
    }),
  );

  return enrichedDocs;
}

export async function uploadExhibitionDocumentHandler(
  ctx: MutationCtx,
  args: {
    exhibitionId: Id<"exhibitions">;
    storageId: Id<"_storage">;
    documentType:
      | "floor_plan"
      | "label"
      | "press_release"
      | "checklist"
      | "other";
    fileName: string;
  },
) {
  const [userId, exhibition] = await Promise.all([
    getAuthUserId(ctx),
    ctx.db.get(args.exhibitionId),
  ] as const);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  if (!exhibition) {
    throw new Error("Exhibition not found");
  }
  await Promise.all([
    requireExhibitionAccess(ctx, exhibition.organizationId),
    requirePermission(ctx, exhibition.organizationId, "collections.update"),
  ]);
  const documentId = await ctx.db.insert("exhibitionDocuments", {
    exhibitionId: args.exhibitionId,
    storageId: args.storageId,
    documentType: args.documentType,
    fileName: args.fileName,
    uploadedBy: userId,
    uploadedAt: Date.now(),
  });

  return documentId;
}

export async function deleteExhibitionDocumentHandler(
  ctx: MutationCtx,
  args: { documentId: Id<"exhibitionDocuments"> },
) {
  const [userId, document] = await Promise.all([
    getAuthUserId(ctx),
    ctx.db.get(args.documentId),
  ] as const);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  if (!document) {
    throw new Error("Document not found");
  }

  const exhibition = await ctx.db.get(document.exhibitionId);
  if (!exhibition) {
    throw new Error("Exhibition not found");
  }
  await Promise.all([
    requireExhibitionAccess(ctx, exhibition.organizationId),
    requirePermission(ctx, exhibition.organizationId, "collections.delete"),
  ]);
  return rejectPermanentEvidenceDeletion();
}
