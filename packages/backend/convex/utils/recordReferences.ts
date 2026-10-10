import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

type Ctx = Pick<QueryCtx, "db">;

export type ReferenceProblem = "missing" | "other_organization" | "self";

/** A stored reference that no longer leads to a record of the organization. */
export interface BrokenReference<Field extends string> {
  field: Field;
  /** The reference exactly as stored. */
  referencedId: string;
  problem: ReferenceProblem;
}

function ownershipProblem(
  organizationId: Id<"organizations">,
  record: { organizationId: Id<"organizations"> } | null,
): ReferenceProblem | null {
  if (!record) return "missing";
  return record.organizationId === organizationId ? null : "other_organization";
}

/** Broken parent, location and collection group references of an Object. */
export async function objectReferenceProblems(
  ctx: Ctx,
  object: Doc<"collections">,
): Promise<
  BrokenReference<"parentObject" | "currentLocation" | "collectionGroup">[]
> {
  const problems: BrokenReference<
    "parentObject" | "currentLocation" | "collectionGroup"
  >[] = [];
  const { parentObjectId, currentLocationId, collectionGroupId } = object;
  if (parentObjectId) {
    const problem =
      parentObjectId === object._id
        ? "self"
        : ownershipProblem(
            object.organizationId,
            await ctx.db.get(parentObjectId),
          );
    if (problem)
      problems.push({
        field: "parentObject",
        referencedId: parentObjectId,
        problem,
      });
  }
  if (currentLocationId) {
    const problem = ownershipProblem(
      object.organizationId,
      await ctx.db.get(currentLocationId),
    );
    if (problem)
      problems.push({
        field: "currentLocation",
        referencedId: currentLocationId,
        problem,
      });
  }
  if (collectionGroupId) {
    const problem = ownershipProblem(
      object.organizationId,
      await ctx.db.get(collectionGroupId),
    );
    if (problem)
      problems.push({
        field: "collectionGroup",
        referencedId: collectionGroupId,
        problem,
      });
  }
  return problems;
}

/** Broken Object and donor account references of an accession. */
export async function accessionReferenceProblems(
  ctx: Ctx,
  accession: Doc<"accessions">,
): Promise<BrokenReference<"object" | "donorAccount">[]> {
  const problems: BrokenReference<"object" | "donorAccount">[] = [];
  if (accession.collectionId) {
    const problem = ownershipProblem(
      accession.organizationId,
      await ctx.db.get(accession.collectionId),
    );
    if (problem)
      problems.push({
        field: "object",
        referencedId: accession.collectionId,
        problem,
      });
  }
  if (accession.donorAccountId) {
    const problem = ownershipProblem(
      accession.organizationId,
      await ctx.db.get(accession.donorAccountId),
    );
    if (problem)
      problems.push({
        field: "donorAccount",
        referencedId: accession.donorAccountId,
        problem,
      });
  }
  return problems;
}

/** A broken Object reference of a deaccession. */
export async function deaccessionReferenceProblems(
  ctx: Ctx,
  deaccession: Doc<"deaccessions">,
): Promise<BrokenReference<"object">[]> {
  const problem = ownershipProblem(
    deaccession.organizationId,
    await ctx.db.get(deaccession.collectionId),
  );
  return problem
    ? [{ field: "object", referencedId: deaccession.collectionId, problem }]
    : [];
}
