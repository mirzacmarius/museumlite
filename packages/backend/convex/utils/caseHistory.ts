import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export interface ApprovalEvidence {
  step: number;
  approvedBy: Id<"users">;
  approvedAt: number;
  comment?: string;
  approverName?: string;
}
export interface HistoryCase {
  _id: string;
  organizationId: Id<"organizations">;
  workflowHistory?: ApprovalEvidence[];
}

export async function appendCaseHistory(
  ctx: MutationCtx,
  entity: HistoryCase,
  caseType: string,
  history: ApprovalEvidence[],
) {
  const newEntries = history.slice(entity.workflowHistory?.length ?? 0);
  if (newEntries.length > 100)
    throw new Error("Workflow history append exceeds batch size");
  if (!newEntries.length) return {};
  let state = await ctx.db
    .query("caseHistoryState")
    .withIndex("by_organization_and_caseType_and_entityId", (q) =>
      q
        .eq("organizationId", entity.organizationId)
        .eq("caseType", caseType)
        .eq("entityId", entity._id),
    )
    .unique();
  if (!state) {
    const sourceLength = entity.workflowHistory?.length ?? 0;
    const id = await ctx.db.insert("caseHistoryState", {
      organizationId: entity.organizationId,
      caseType,
      entityId: entity._id,
      sourceLength,
      migratedThrough: 0,
      nextOrdinal: sourceLength,
      cutoverAt: Date.now(),
    });
    state = (await ctx.db.get(id))!;
  }
  let ordinal = state.nextOrdinal;
  for (const entry of newEntries) {
    const actor = await ctx.db.get(entry.approvedBy);
    await ctx.db.insert("caseHistoryEntries", {
      organizationId: entity.organizationId,
      caseType,
      entityId: entity._id,
      ordinal: ordinal++,
      entry: {
        ...entry,
        approverName: actor?.name ?? actor?.username ?? actor?.email,
      },
      evidenceStatus: "recorded",
    });
  }
  await ctx.db.patch(state._id, { nextOrdinal: ordinal });
  // Preserve the original embedded evidence. Future approvals grow only child rows.
  return {};
}

export async function recentCaseHistory(
  ctx: QueryCtx,
  entity: HistoryCase,
  caseType: string,
) {
  const rows = await ctx.db
    .query("caseHistoryEntries")
    .withIndex("by_organization_and_caseType_and_entityId_and_ordinal", (q) =>
      q
        .eq("organizationId", entity.organizationId)
        .eq("caseType", caseType)
        .eq("entityId", entity._id)
        .gte("ordinal", entity.workflowHistory?.length ?? 0),
    )
    .order("desc")
    .take(100);
  const entries = [
    ...(entity.workflowHistory ?? []),
    ...rows.reverse().map((row) => row.entry),
  ].slice(-100);
  const state = await ctx.db
    .query("caseHistoryState")
    .withIndex("by_organization_and_caseType_and_entityId", (q) =>
      q
        .eq("organizationId", entity.organizationId)
        .eq("caseType", caseType)
        .eq("entityId", entity._id),
    )
    .unique();
  return {
    entries,
    isPreview: true as const,
    hasMore:
      (state?.nextOrdinal ?? entity.workflowHistory?.length ?? 0) >
      entries.length,
  };
}
