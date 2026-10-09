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
      case "DEPOSITOR_REQUIRED":
        return t("depositorRequired");
      case "TITLE_REQUIRED":
        return t("titleRequired");
      case "CONDITION_REQUIRED":
        return t("conditionRequired");
      case "TEXT_TOO_LONG":
        return t("textTooLong");
      case "DATES_INVALID":
        return t("datesInvalid");
      case "RESPONSIBLE_NOT_MEMBER":
        return t("responsibleNotMember");
      case "NUMBER_IN_USE":
        return t("numberInUse");
      case "NUMBERING_EXHAUSTED":
        return t("numberingExhausted");
      case "NOT_IN_CUSTODY":
        return t("notInCustody");
      case "ACQUISITION_OPEN":
        return t("acquisitionOpen");
      case "ENTRY_CLOSED":
        return t("entryClosed");
      case "OWNER_REQUIRED":
        return t("ownerRequired");
      case "RECIPIENT_REQUIRED":
        return t("recipientRequired");
      case "TEMPORARY_CUSTODY":
        return t("temporaryCustody");
      case "ENTRY_EXITED":
        return t("entryExited");
      case "OBJECT_RECORDED_ON_ENTRY":
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
