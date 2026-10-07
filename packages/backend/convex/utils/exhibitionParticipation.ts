import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type DatabaseContext = QueryCtx | MutationCtx;

export interface ExhibitionParticipantInput {
  collectionId: Id<"collections">;
  role: "featured" | "participant";
}

export async function getExhibitionParticipants(
  ctx: DatabaseContext,
  exhibitionId: Id<"exhibitions">,
) {
  const rows = await ctx.db
    .query("exhibitionObjects")
    .withIndex("by_exhibition", (q) => q.eq("exhibitionId", exhibitionId))
    .collect();
  return rows.sort(
    (a, b) =>
      (a.order ?? a._creationTime) - (b.order ?? b._creationTime) ||
      a._creationTime - b._creationTime,
  );
}

export async function getExhibitionsForObject(
  ctx: DatabaseContext,
  collectionId: Id<"collections">,
) {
  const [members, legacyAnchors] = await Promise.all([
    ctx.db
      .query("exhibitionObjects")
      .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
      .collect(),
    ctx.db
      .query("exhibitions")
      .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
      .collect(),
  ]);
  const exhibitions = await Promise.all(members.map((member) => ctx.db.get(member.exhibitionId)));
  const byId = new Map<Id<"exhibitions">, Doc<"exhibitions">>();
  for (const exhibition of exhibitions) {
    if (exhibition) byId.set(exhibition._id, exhibition);
  }
  for (const exhibition of legacyAnchors) {
    if (exhibition.participationVersion !== "members") byId.set(exhibition._id, exhibition);
  }
  return [...byId.values()].sort((a, b) => b._creationTime - a._creationTime);
}

export async function validateExhibitionParticipants(
  ctx: DatabaseContext,
  organizationId: Id<"organizations">,
  participants: ExhibitionParticipantInput[],
) {
  if (participants.length === 0) throw new Error("Select at least one exhibition object");
  if (new Set(participants.map((member) => member.collectionId)).size !== participants.length) {
    throw new Error("An object can appear only once in an exhibition");
  }
  if (participants.filter((member) => member.role === "featured").length > 1) {
    throw new Error("Only one featured object is allowed");
  }
  for (const participant of participants) {
    const object = await ctx.db.get(participant.collectionId);
    if (!object || object.organizationId !== organizationId) {
      throw new Error("Object does not belong to the same organization");
    }
  }
}

export async function getLegacyParticipationReview(
  ctx: DatabaseContext,
  exhibition: Doc<"exhibitions">,
) {
  if (exhibition.participationVersion === "members" || !exhibition.collectionId) return null;
  const members = await getExhibitionParticipants(ctx, exhibition._id);
  const anchorIsMember = members.some((member) => member.collectionId === exhibition.collectionId);
  return {
    anchorCollectionId: exhibition.collectionId,
    reason: members.length === 0 ? "anchor_only" as const :
      anchorIsMember ? "anchor_and_members" as const : "anchor_missing_from_members" as const,
    memberCount: members.length,
  };
}
