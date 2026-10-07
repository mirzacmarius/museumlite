import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/**
 * Accession search documents back indexed accession search. Every writer that
 * creates an accession or changes its searchable fields or status must sync.
 */
function buildSearchText(values: Array<string | null | undefined>) {
  return values
    .flatMap((value) => {
      const trimmedValue = value?.trim();
      return trimmedValue ? [trimmedValue] : [];
    })
    .join(" ");
}

async function buildAccessionSearchText(
  ctx: MutationCtx,
  accession: Doc<"accessions">,
) {
  const collection = accession.collectionId
    ? await ctx.db.get(accession.collectionId)
    : null;

  return buildSearchText([
    accession.accessionNumber,
    accession.draftObjectData?.title,
    accession.source,
    accession.notes,
    collection?.title,
    accession.method,
  ]);
}

export async function upsertAccessionSearchDocument(
  ctx: MutationCtx,
  accession: Doc<"accessions">,
) {
  const [searchText, existing] = await Promise.all([
    buildAccessionSearchText(ctx, accession),
    ctx.db
      .query("accessionSearchDocuments")
      .withIndex("by_accession", (q) => q.eq("accessionId", accession._id))
      .first(),
  ] as const);
  const fields = {
    organizationId: accession.organizationId,
    accessionId: accession._id,
    status: accession.status,
    searchText,
    dateReceived: accession.dateReceived,
  };

  if (existing) {
    await ctx.db.patch(existing._id, fields);
    return;
  }

  await ctx.db.insert("accessionSearchDocuments", fields);
}

export async function syncAccessionSearchDocument(
  ctx: MutationCtx,
  accessionId: Id<"accessions">,
) {
  const accession = await ctx.db.get(accessionId);
  if (accession) {
    await upsertAccessionSearchDocument(ctx, accession);
  }
}
