import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type {
  DocumentationRequirement,
  DocumentationStage,
} from "./documentationQualityValidators";
import { isUnaccessionedEntryObject } from "./objectEntryLifecycle";

type Ctx = Pick<QueryCtx, "db">;

/** Loan links read per Object when telling borrowed property apart. */
const LOAN_LINKS_CHECKED = 32;
/** Rows read per Object when looking for one in its organization. */
const EVIDENCE_ROWS_CHECKED = 5;
const RECORDED_TEXT_LIMIT = 500;

/**
 * The Object's stage, following the inventory definition: property held
 * under an Entry that was never accessioned is not part of the collection,
 * and neither is property linked to an incoming loan.
 */
export async function objectStage(
  ctx: Ctx,
  object: Doc<"collections">,
): Promise<DocumentationStage> {
  if (object.status === "deaccessioned") return "deaccessioned";
  if (await isUnaccessionedEntryObject(ctx, object._id)) return "entry";
  const links = await ctx.db
    .query("loanItems")
    .withIndex("by_collection", (q) => q.eq("collectionId", object._id))
    .take(LOAN_LINKS_CHECKED);
  for (const link of links) {
    const loan = await ctx.db.get(link.loanId);
    if (
      loan?.organizationId === object.organizationId &&
      loan.type === "incoming"
    )
      return "borrowed";
  }
  return "collection";
}

function filled(value: string | undefined) {
  return !!value?.trim();
}

async function meetsRequirement(
  ctx: Ctx,
  object: Doc<"collections">,
  requirement: DocumentationRequirement,
): Promise<boolean> {
  const own = (row: { organizationId: Doc<"collections">["organizationId"] }) =>
    row.organizationId === object.organizationId;
  switch (requirement) {
    case "object_type":
      return filled(object.objectType);
    case "object_name":
      return filled(object.objectName);
    case "maker":
      return filled(object.creator);
    case "production_date":
      return filled(object.dateCreated);
    case "materials":
      return filled(object.materials);
    case "dimensions":
      return (
        filled(object.dimensions) ||
        filled(object.dimensionDiameter) ||
        [
          object.dimensionHeight,
          object.dimensionWidth,
          object.dimensionDepth,
          object.dimensionWeight,
        ].some((value) => value !== undefined)
      );
    case "inscriptions":
      return (
        filled(object.inscriptions) ||
        (object.inscriptionMarks ?? []).some((mark) => filled(mark.description))
      );
    case "description":
      return filled(object.description);
    case "current_location":
      return object.currentLocationId !== undefined;
    case "condition_assessment":
      return (
        await ctx.db
          .query("conditionAssessments")
          .withIndex("by_collection_and_status_and_acceptedAt", (q) =>
            q.eq("collectionId", object._id).eq("status", "accepted"),
          )
          .take(EVIDENCE_ROWS_CHECKED)
      ).some(own);
    case "image":
      return (
        await ctx.db
          .query("mediaFiles")
          .withIndex("by_collection_and_fileType", (q) =>
            q.eq("collectionId", object._id).eq("fileType", "image"),
          )
          .take(EVIDENCE_ROWS_CHECKED)
      ).some(own);
    case "supporting_document":
      return (
        await ctx.db
          .query("mediaFiles")
          .withIndex("by_collection_and_category", (q) =>
            q.eq("collectionId", object._id).eq("mediaCategory", "document"),
          )
          .take(EVIDENCE_ROWS_CHECKED)
      ).some(own);
    case "accession_record":
      return (
        await ctx.db
          .query("accessions")
          .withIndex("by_collection", (q) => q.eq("collectionId", object._id))
          .take(EVIDENCE_ROWS_CHECKED)
      ).some((accession) => own(accession) && accession.status === "approved");
    case "provenance_claim":
      return (
        (await ctx.db
          .query("provenanceClaims")
          .withIndex("by_organization_and_objectId_and_supersededAt", (q) =>
            q
              .eq("organizationId", object.organizationId)
              .eq("objectId", object._id)
              .eq("supersededAt", undefined),
          )
          .first()) !== null
      );
  }
}

/**
 * The requirements an Object does not meet, in the order given. Each kind
 * of evidence is read at most once per Object, whatever the profile count.
 */
export function objectEvidence(ctx: Ctx, object: Doc<"collections">) {
  const answers = new Map<DocumentationRequirement, Promise<boolean>>();
  return async (requirements: readonly DocumentationRequirement[]) => {
    const missing: DocumentationRequirement[] = [];
    for (const requirement of requirements) {
      let answer = answers.get(requirement);
      if (!answer) {
        answer = meetsRequirement(ctx, object, requirement);
        answers.set(requirement, answer);
      }
      if (!(await answer)) missing.push(requirement);
    }
    return missing;
  };
}

function clip(value: string | undefined) {
  const text = value?.trim();
  if (!text) return undefined;
  return text.length > RECORDED_TEXT_LIMIT
    ? `${text.slice(0, RECORDED_TEXT_LIMIT - 1)}…`
    : text;
}

/**
 * Legacy text an Object already carries for evidence it lacks, so reviewers
 * see what the record says without it being turned into an assessment or a
 * provenance claim.
 */
export function recordedLegacyText(
  object: Doc<"collections">,
  missing: readonly DocumentationRequirement[],
) {
  const condition = missing.includes("condition_assessment")
    ? clip(object.legacyConditionSnapshot ?? object.condition)
    : undefined;
  const provenance = missing.includes("provenance_claim")
    ? clip(object.provenance)
    : undefined;
  return condition || provenance ? { condition, provenance } : undefined;
}
