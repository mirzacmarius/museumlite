import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { rejectPermanentEvidenceDeletion } from "./evidenceRetention";
import { requireCapability } from "./permissions";
import { claimStorageOwnership } from "./uploadOwnership";

export async function uploadLoanDocumentHandler(
  ctx: MutationCtx,
  args: {
    loanId: Id<"loans">;
    storageId: Id<"_storage">;
    documentType: "agreement" | "insurance" | "other";
    fileName: string;
  },
) {
  const [userId, loan] = await Promise.all([
    getAuthUserId(ctx),
    ctx.db.get(args.loanId),
  ] as const);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  if (!loan) {
    throw new Error("Loan not found");
  }
  await requireCapability(ctx, loan.organizationId, "loans", "loans.update");
  const documentId = await ctx.db.insert("loanDocuments", {
    loanId: args.loanId,
    storageId: args.storageId,
    documentType: args.documentType,
    fileName: args.fileName,
    uploadedBy: userId,
    uploadedAt: Date.now(),
  });
  await claimStorageOwnership(ctx, {
    storageId: args.storageId,
    organizationId: loan.organizationId,
    uploadedBy: userId,
    ownerType: "loanDocument",
    ownerId: documentId,
  });

  return documentId;
}

export async function listLoanDocumentsHandler(
  ctx: QueryCtx,
  args: { loanId: Id<"loans"> },
) {
  const loan = await ctx.db.get(args.loanId);
  if (!loan) {
    throw new Error("Loan not found");
  }
  await requireCapability(ctx, loan.organizationId, "loans", "loans.read");
  const documents = await ctx.db
    .query("loanDocuments")
    .withIndex("by_loan", (q) => q.eq("loanId", args.loanId))
    .collect();

  const documentsWithUrls = await Promise.all(
    documents.map(async (doc) => {
      const [url, uploader] = await Promise.all([
        ctx.storage.getUrl(doc.storageId),
        ctx.db.get(doc.uploadedBy),
      ] as const);
      return {
        _id: doc._id,
        storageId: doc.storageId,
        documentType: doc.documentType,
        fileName: doc.fileName,
        url,
        uploadedBy: doc.uploadedBy,
        uploadedAt: doc.uploadedAt,
        uploaderName: uploader?.name || uploader?.username || undefined,
      };
    }),
  );

  return documentsWithUrls;
}

export async function deleteLoanDocumentHandler(
  ctx: MutationCtx,
  args: { documentId: Id<"loanDocuments"> },
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

  const loan = await ctx.db.get(document.loanId);
  if (!loan) {
    throw new Error("Loan not found");
  }
  await requireCapability(ctx, loan.organizationId, "loans", "loans.update");
  return rejectPermanentEvidenceDeletion();
}
