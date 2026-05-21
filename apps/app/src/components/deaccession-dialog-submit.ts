import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { AccessionMode, RemovalType } from "./deaccession-dialog-types";

interface SubmitDeaccessionParams {
  removalType: RemovalType;
  reason: string;
  organizationId: Id<"organizations">;
  collectionId: Id<"collections">;
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
    const deaccessionId = await createDeaccession({
      ...basePayload,
      method: "destruction",
      targetCollectionStatus: "archived",
    });
    return { kind: "deaccession", id: deaccessionId };
  }

  const deaccessionId = await createDeaccession({
    ...basePayload,
    method: "destruction",
    targetCollectionStatus: "deleted",
  });
  return { kind: "deaccession", id: deaccessionId };
}

export function getDeaccessionDialogCopy(
  removalType: RemovalType | null,
  collectionTitle: string,
) {
  const dialogTitle = (() => {
    if (removalType === "sold") return "Record sale";
    if (removalType === "move") return "Move to another organization";
    if (removalType === "archived") return "Archive";
    if (removalType === "deleted") return "Delete";
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
      return `Submit an archive request for ${collectionTitle}.`;
    }
    if (removalType === "deleted") {
      return `Submit a delete request for ${collectionTitle}.`;
    }
    return `Choose how to remove or transfer ${collectionTitle}.`;
  })();

  return { dialogTitle, dialogDescription };
}
