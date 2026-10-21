import type { TransferStage } from "@v1/backend/convex/utils/transferStages";
import type { useI18n } from "@/locales/client";

type TranslationKey = Parameters<ReturnType<typeof useI18n>>[0];

/**
 * The name of each transfer stage the backend reports, the same on the
 * Transfers board and the transfer page.
 */
export const TRANSFER_STAGE_LABELS: Record<TransferStage, TranslationKey> = {
  waiting_for_sender:
    "untranslatedRecords.accessions.transfers.pendingApproval",
  waiting_for_receiver:
    "untranslatedRecords.accessions.transfers.awaitingAcceptance",
  received: "untranslatedRecords.accessions.transfers.executed",
  declined: "untranslatedRecords.accessions.transfers.rejected",
  cancelled: "untranslatedRecords.accessions.transfers.cancelled",
};
