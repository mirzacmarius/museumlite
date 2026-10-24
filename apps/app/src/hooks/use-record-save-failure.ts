"use client";

import { recordEditErrorFromError } from "@v1/backend/convex/utils/recordEdits";
import { ConvexError } from "convex/values";
import { useCallback } from "react";
import { useCapabilityErrorMessage } from "@/hooks/use-capability-error-message";
import { useIdentifierErrorMessage } from "@/hooks/use-identifier-error-message";
import type { RecordSaveFailure } from "@/lib/record-form";
import { useScopedI18n } from "@/locales/client";

/** A plain-text explanation the server sent on purpose, if any. */
function serverExplanation(error: unknown): string | null {
  if (
    !(error instanceof ConvexError) ||
    typeof error.data !== "string" ||
    error.data.trim().startsWith("{")
  ) {
    return null;
  }
  return error.data.trim() || null;
}

/** A form's own reading of an error, e.g. custody or module conflicts. */
export type DescribeFormError = (
  error: unknown,
) => { message: string; field?: string } | null;

/**
 * Turns a failed save into what staff can do about it: a stale version, a
 * field to correct, a missing permission, a record that left its editable
 * state, or a retry. Unknown failures never show raw server text.
 */
export function useRecordSaveFailure({
  fieldLabel,
  describe,
}: {
  fieldLabel: (field: string) => string;
  describe?: DescribeFormError;
}) {
  const t = useScopedI18n("recordForm.errors");
  const capabilityMessage = useCapabilityErrorMessage();
  const identifierMessage = useIdentifierErrorMessage();

  return useCallback(
    (error: unknown): RecordSaveFailure => {
      const edit = recordEditErrorFromError(error);
      if (edit) {
        const field = edit.field ?? "";
        const label = fieldLabel(field);
        switch (edit.code) {
          case "EDIT_CONFLICT":
            return { kind: "conflict", message: t("conflict") };
          case "RECORD_NOT_EDITABLE":
            return { kind: "locked", message: t("notEditable") };
          case "FIELD_REQUIRED":
            return {
              kind: "field",
              field,
              message: t("required", { field: label }),
            };
          case "IDENTIFIER_PERMANENT":
            return {
              kind: "field",
              field,
              message: t("identifierPermanent"),
            };
          case "RELATED_RECORD_UNAVAILABLE":
            return {
              kind: "field",
              field,
              message: t("relatedRecordUnavailable", { field: label }),
            };
          case "PARENT_IS_SELF":
            return { kind: "field", field, message: t("parentIsSelf") };
          case "CONDITION_SET_BY_ASSESSMENT":
            return {
              kind: "field",
              field,
              message: t("conditionSetByAssessment"),
            };
          case "CONDITION_NOTE_REQUIRED":
            return {
              kind: "field",
              field,
              message: t("conditionNoteRequired"),
            };
          case "DATE_ORDER_INVALID":
            return { kind: "field", field, message: t("dateOrderInvalid") };
          case "PARTY_MANAGED_FIELD":
            return { kind: "field", field, message: t("partyManagedField") };
          case "PRODUCTION_DATE_INVALID":
            return {
              kind: "field",
              field,
              message: t("productionDateInvalid"),
            };
        }
      }
      const denied = capabilityMessage(error);
      if (denied) return { kind: "denied", message: denied };
      const described = describe?.(error);
      if (described) {
        return described.field
          ? {
              kind: "field",
              field: described.field,
              message: described.message,
            }
          : { kind: "rejected", message: described.message };
      }
      const identifier = identifierMessage(error);
      if (identifier) return { kind: "rejected", message: identifier };
      const explanation = serverExplanation(error);
      if (explanation) return { kind: "rejected", message: explanation };
      return { kind: "failed", message: t("saveFailed") };
    },
    [capabilityMessage, describe, fieldLabel, identifierMessage, t],
  );
}
