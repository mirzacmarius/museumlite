"use client";

import { useCallback } from "react";
import {
  productionDateDraftSchema,
  productionDateFromDraft,
} from "@/components/production-date/production-date-draft";
import { useProductionDateFormat } from "@/components/production-date/use-production-date-format";

/**
 * Catalog form values that are not text, as notices show them: the
 * structured date made as a date in the app language. Null for the rest.
 */
export function useCollectionFieldValue() {
  const dates = useProductionDateFormat();
  return useCallback(
    (field: string, value: unknown): string | null => {
      if (field !== "dateCreatedEdtf") return null;
      const draft = productionDateDraftSchema.safeParse(value);
      const date = draft.success ? productionDateFromDraft(draft.data) : null;
      return date ? dates.date(date) : null;
    },
    [dates],
  );
}
