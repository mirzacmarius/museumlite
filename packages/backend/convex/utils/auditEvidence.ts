import type { Id, TableNames } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

const subjectTables: Record<string, TableNames> = {
  collection: "collections",
  loan: "loans",
  accession: "accessions",
  deaccession: "deaccessions",
  location: "locations",
  media: "mediaFiles",
  user: "users",
  organization: "organizations",
  collectionGroup: "collectionGroups",
  exhibition: "exhibitions",
  conservationTreatment: "conservationTreatments",
  conditionAssessment: "conditionAssessments",
  conditionOption: "conditionOptions",
  account: "accounts",
  contact: "contacts",
  transitRecord: "transitRecords",
  organizationMoveRequest: "organizationMoveRequests",
  libraryAcquisitionRequest: "libraryAcquisitionRequests",
  objectEntry: "objectEntries",
};
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function text(data: Record<string, unknown>, fields: string[]) {
  for (const field of fields)
    if (typeof data[field] === "string") return data[field] as string;
  return undefined;
}

export async function captureAuditEvidence(
  ctx: MutationCtx,
  args: {
    organizationId: Id<"organizations">;
    userId: Id<"users">;
    entityType: string;
    action: string;
    entityId: string;
    changes?: unknown;
  },
) {
  const user = await ctx.db.get(args.userId);
  const table = subjectTables[args.entityType];
  const id = table ? ctx.db.normalizeId(table, args.entityId) : null;
  const currentSubject = id ? record(await ctx.db.get(id)) : {};
  const subject =
    currentSubject.organizationId &&
    currentSubject.organizationId !== args.organizationId
      ? {}
      : currentSubject;
  const changes = record(args.changes);
  const data = { ...record(changes.entityData), ...changes, ...subject };
  const referencedObject = text({ ...record(changes.entityData), ...changes }, [
    "collectionId",
    "objectId",
  ]);
  const objectId =
    args.entityType === "collection"
      ? (ctx.db.normalizeId("collections", args.entityId) ?? undefined)
      : referencedObject
        ? (ctx.db.normalizeId("collections", referencedObject) ?? undefined)
        : undefined;
  let caseId = [
    "loan",
    "accession",
    "deaccession",
    "exhibition",
    "conservationTreatment",
    "transitRecord",
    "organizationMoveRequest",
    "libraryAcquisitionRequest",
    "objectEntry",
    "documentationFinding",
    "reproductionRequest",
    "inventoryException",
  ].includes(args.entityType)
    ? `${args.entityType}:${args.entityId}`
    : undefined;
  const references = {
    loan: "loans",
    accession: "accessions",
    deaccession: "deaccessions",
    exhibition: "exhibitions",
    conservationTreatment: "conservationTreatments",
    documentationFinding: "documentationFindings",
    inventoryException: "inventoryExceptions",
  } as const;
  for (const kind of Object.keys(references)) {
    if (caseId) break;
    const value = text({ ...record(changes.entityData), ...changes }, [
      `${kind}Id`,
    ]);
    if (!value) continue;
    caseId = `${kind}:${value}`;
    break;
  }
  if (!caseId && typeof changes.transitRecordId === "string")
    caseId = `transitRecord:${changes.transitRecordId}`;
  if (
    !caseId &&
    args.action === "received_collection_from_organization_move" &&
    typeof changes.requestId === "string"
  )
    caseId = `organizationMoveRequest:${changes.requestId}`;
  return {
    actorSnapshot: { name: user?.name ?? user?.username, email: user?.email },
    subjectSnapshot: {
      label: text(data, ["title", "name", "lenderBorrowerName", "summary"]),
      identifier:
        text(data, [
          "accessionNumber",
          "loanNumber",
          "locationCode",
          "referenceNumber",
          "entryNumber",
          "requestNumber",
        ]) ?? args.entityId,
    },
    objectId,
    caseId,
  };
}
