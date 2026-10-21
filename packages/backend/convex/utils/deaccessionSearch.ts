import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/**
 * Deaccession search documents back the Removals board search. Every writer
 * that creates a Deaccession or changes its searchable fields or status must
 * sync.
 */
function buildSearchText(values: Array<string | null | undefined>) {
  return values
    .flatMap((value) => {
      const trimmedValue = value?.trim();
      return trimmedValue ? [trimmedValue] : [];
    })
    .join(" ");
}

async function buildDeaccessionSearchText(
  ctx: MutationCtx,
  deaccession: Doc<"deaccessions">,
) {
  const collection = await ctx.db.get(deaccession.collectionId);

  return buildSearchText([
    deaccession.deaccessionNumber,
    deaccession.reason,
    deaccession.disposition,
    deaccession.notes,
    collection?.title,
    collection?.accessionNumber,
    deaccession.method,
  ]);
}

/** Writes the Deaccession's search document; true when it had none. */
export async function upsertDeaccessionSearchDocument(
  ctx: MutationCtx,
  deaccession: Doc<"deaccessions">,
) {
  const [searchText, existing] = await Promise.all([
    buildDeaccessionSearchText(ctx, deaccession),
    ctx.db
      .query("deaccessionSearchDocuments")
      .withIndex("by_deaccession", (q) =>
        q.eq("deaccessionId", deaccession._id),
      )
      .first(),
  ] as const);
  const fields = {
    organizationId: deaccession.organizationId,
    deaccessionId: deaccession._id,
    status: deaccession.status,
    searchText,
    dateDeaccessioned: deaccession.dateDeaccessioned,
  };

  if (existing) {
    await ctx.db.patch(existing._id, fields);
    return false;
  }

  await ctx.db.insert("deaccessionSearchDocuments", fields);
  return true;
}

export async function syncDeaccessionSearchDocument(
  ctx: MutationCtx,
  deaccessionId: Id<"deaccessions">,
) {
  const deaccession = await ctx.db.get(deaccessionId);
  if (deaccession) {
    await upsertDeaccessionSearchDocument(ctx, deaccession);
  }
}
