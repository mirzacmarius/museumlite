import { custodyConflictFromError } from "@v1/backend/convex/utils/custodyErrors";
import {
  type EntryErrorCode,
  entryErrorFromError,
} from "@v1/backend/convex/utils/objectEntryErrors";
import { partyErrorFromError } from "@v1/backend/convex/utils/partyErrors";
import { useCustodyConflictMessage } from "@/hooks/use-custody-conflict-message";
import { usePartyErrorMessage } from "@/hooks/use-party-error-message";
import { useScopedI18n } from "@/locales/client";

/**
 * Translates failures of entry commands, including the custody conflicts and
 * party errors they can raise. Server error text is never shown.
 */
export function useEntryErrorMessage() {
  const t = useScopedI18n("objectEntries.errors");
  const custodyMessage = useCustodyConflictMessage();
  const partyMessage = usePartyErrorMessage();
  function codeMessage(code: EntryErrorCode) {
    switch (code) {
      case "ENTRY_NOT_FOUND":
        return t("entryNotFound");
      case "ENTRY_DEPOSITOR_REQUIRED":
        return t("depositorRequired");
      case "ENTRY_TITLE_REQUIRED":
        return t("titleRequired");
      case "ENTRY_CONDITION_REQUIRED":
        return t("conditionRequired");
      case "ENTRY_TEXT_TOO_LONG":
        return t("textTooLong");
      case "ENTRY_DATES_INVALID":
        return t("datesInvalid");
      case "ENTRY_RESPONSIBLE_NOT_MEMBER":
        return t("responsibleNotMember");
      case "ENTRY_NUMBER_IN_USE":
        return t("numberInUse");
      case "ENTRY_NUMBER_INVALID":
        return t("numberInvalid");
      case "ENTRY_ACQUISITION_IN_REVIEW":
        return t("acquisitionInReview");
      case "ENTRY_REASON_REQUIRED":
        return t("reasonRequired");
      case "ENTRY_EXIT_REQUIRED":
        return t("exitRequired");
      case "ENTRY_NUMBERING_EXHAUSTED":
        return t("numberingExhausted");
      case "ENTRY_NOT_IN_CUSTODY":
        return t("notInCustody");
      case "ENTRY_ACQUISITION_OPEN":
        return t("acquisitionOpen");
      case "ENTRY_CLOSED":
        return t("entryClosed");
      case "ENTRY_OWNER_REQUIRED":
        return t("ownerRequired");
      case "ENTRY_RECIPIENT_REQUIRED":
        return t("recipientRequired");
      case "ENTRY_TEMPORARY_CUSTODY":
        return t("temporaryCustody");
      case "ENTRY_EXITED":
        return t("entryExited");
      case "ENTRY_OBJECT_RECORDED":
        return t("objectRecordedOnEntry");
    }
  }

  return (error: unknown) => {
    const entryError = entryErrorFromError(error);
    if (entryError) return codeMessage(entryError.code);
    if (custodyConflictFromError(error)) return custodyMessage(error);
    if (partyErrorFromError(error)) return partyMessage(error);
    return t("fallback");
  };
}
