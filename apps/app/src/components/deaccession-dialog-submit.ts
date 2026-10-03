import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { AccessionMode, RemovalType } from "./deaccession-dialog-types";

type Translate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

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
  translate: Translate;
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
  translate,
  createDeaccession,
  createMoveRequest,
}: SubmitDeaccessionParams): Promise<
  | { kind: "deaccession"; id: Id<"deaccessions"> }
  | { kind: "move"; id: Id<"organizationMoveRequests"> }
> {
  if (!reason.trim()) {
    throw new Error(
      translate("untranslatedComponents.deaccession.reasonRequired"),
    );
  }

  if (removalType === "move") {
    if (!targetOrganizationId) {
      throw new Error(
        translate(
          "untranslatedComponents.deaccession.destinationOrganizationRequired",
        ),
      );
    }

    if (accessionMode === "manual" && !manualAccessionNumber.trim()) {
      throw new Error(
        translate(
          "untranslatedComponents.deaccession.manualAccessionNumberRequired",
        ),
      );
    }

    if (moveEligibility && !moveEligibility.isEligible) {
      throw new Error(
        translate(
          "untranslatedComponents.deaccession.moveBlockersMustBeResolved",
        ),
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
  translate: Translate,
) {
  const dialogTitle = (() => {
    if (removalType === "sold")
      return translate("untranslatedComponents.deaccession.recordSale");
    if (removalType === "move")
      return translate(
        "untranslatedComponents.deaccession.moveToAnotherOrganization",
      );
    if (removalType === "archived")
      return translate("untranslatedComponents.deaccession.archive");
    if (removalType === "deleted")
      return translate("untranslatedComponents.deaccession.delete");
    return translate("untranslatedComponents.deaccession.removeOrTransfer");
  })();

  const dialogDescription = (() => {
    if (removalType === "sold") {
      return translate(
        "untranslatedComponents.deaccession.recordSaleDetailsFor",
        { title: collectionTitle },
      );
    }
    if (removalType === "move") {
      return translate("untranslatedComponents.deaccession.requestMoveFor", {
        title: collectionTitle,
      });
    }
    if (removalType === "archived") {
      return translate("untranslatedComponents.deaccession.submitArchiveFor", {
        title: collectionTitle,
      });
    }
    if (removalType === "deleted") {
      return translate("untranslatedComponents.deaccession.submitDeleteFor", {
        title: collectionTitle,
      });
    }
    return translate(
      "untranslatedComponents.deaccession.chooseHowToRemoveTransfer",
      { title: collectionTitle },
    );
  })();

  return { dialogTitle, dialogDescription };
}
