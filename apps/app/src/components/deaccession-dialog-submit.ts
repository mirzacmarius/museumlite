import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { AccessionMode, RemovalType } from "./deaccession-dialog-types";

interface SubmitDeaccessionParams {
  removalType: RemovalType;
  reason: string;
  organizationId: Id<"organizations">;
  collectionId: Id<"collections">;
  archiveCollection: (args: {
    collectionId: Id<"collections">;
    reason: string;
  }) => Promise<null>;
  date: Date;
  method: "sale" | "donation" | "transfer" | "destruction";
  disposition: string;
  notes: string;
  targetOrganizationId: Id<"organizations"> | "";
  accessionMode: AccessionMode;
  manualAccessionNumber: string;
  moveEligibility?: { isEligible: boolean } | null;
  createDeaccession: (args: {
    organizationId: Id<"organizations">;
    collectionId: Id<"collections">;
    dateDeaccessioned: number;
    reason: string;
    method: "sale" | "donation" | "transfer" | "destruction";
    targetCollectionStatus: "deaccessioned" | "archived" | "deleted";
    disposition?: string;
    notes?: string;
  }) => Promise<Id<"deaccessions">>;
  createMoveRequest: (args: {
    collectionId: Id<"collections">;
    targetOrganizationId: Id<"organizations">;
    accessionMode: AccessionMode;
    requestedAccessionNumber?: string;
    reason: string;
    notes?: string;
  }) => Promise<Id<"organizationMoveRequests">>;
}

export async function submitDeaccession({
  removalType,
  reason,
  organizationId,
  collectionId,
  archiveCollection,
  date,
  method,
  disposition,
  notes,
  targetOrganizationId,
  accessionMode,
  manualAccessionNumber,
  moveEligibility,
  createDeaccession,
  createMoveRequest,
}: SubmitDeaccessionParams): Promise<
  | { kind: "deaccession"; id: Id<"deaccessions"> }
  | { kind: "archive" }
  | { kind: "move"; id: Id<"organizationMoveRequests"> }
> {
  if (!reason.trim()) {
    throw new Error("Reason is required");
  }

  if (removalType === "move") {
    if (!targetOrganizationId) {
      throw new Error("Destination organization is required");
    }

    if (accessionMode === "manual" && !manualAccessionNumber.trim()) {
      throw new Error("A manual accession number is required");
    }

    if (moveEligibility && !moveEligibility.isEligible) {
      throw new Error(
        "This object cannot be moved until the blocking issues are resolved",
      );
    }

    const requestId = await createMoveRequest({
      collectionId,
      targetOrganizationId,
      accessionMode,
      requestedAccessionNumber:
        accessionMode === "manual" ? manualAccessionNumber.trim() : undefined,
      reason: reason.trim(),
      notes: notes.trim() || undefined,
    });

    return { kind: "move", id: requestId };
  }

  const basePayload = {
    organizationId,
    collectionId,
    dateDeaccessioned: date.getTime(),
    reason: reason.trim(),
    notes: notes.trim() || undefined,
  };

  if (removalType === "sold") {
    const deaccessionId = await createDeaccession({
      ...basePayload,
      method,
      targetCollectionStatus: "deaccessioned",
      disposition: disposition.trim() || undefined,
    });
    return { kind: "deaccession", id: deaccessionId };
  }

  if (removalType === "archived") {
    await archiveCollection({
      collectionId,
      reason: reason.trim(),
    });
    return { kind: "archive" };
  }

  throw new Error("Unsupported object removal action");
}

export function getDeaccessionDialogCopy(
  removalType: RemovalType | null,
  collectionTitle: string,
) {
  const dialogTitle = (() => {
    if (removalType === "sold") return "Record sale";
    if (removalType === "move") return "Move to another organization";
    if (removalType === "archived") return "Archive";
    return "Remove or transfer";
  })();

  const dialogDescription = (() => {
    if (removalType === "sold") {
      return `Record sale details for ${collectionTitle}.`;
    }
    if (removalType === "move") {
      return `Request a move for ${collectionTitle}.`;
    }
    if (removalType === "archived") {
      return `Withdraw ${collectionTitle} from routine views while retaining its register and linked evidence.`;
    }
    return `Choose how to remove or transfer ${collectionTitle}.`;
  })();

  return { dialogTitle, dialogDescription };
}
