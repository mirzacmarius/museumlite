"use client";

import { useCallback } from "react";
import { useObjectDescriptionFormat } from "@/components/object-description/use-object-description-format";
import {
  productionDateDraftSchema,
  productionDateFromDraft,
} from "@/components/production-date/production-date-draft";
import { useProductionDateFormat } from "@/components/production-date/use-production-date-format";
import { describeObjectDescriptionValue } from "@/lib/object-description-format";
import { measurementSetsFromEntries } from "./measurement-sets";
import { measurementSetEntrySchema, parseNumberOfObjects } from "./utils";

const measurementSetEntriesSchema = measurementSetEntrySchema.array();

/**
 * Catalog form values that are not plain text, as notices show them: the
 * structured date made as a date in the app language, and names instead of
 * codes and URIs for the number of objects, subject, completeness,
 * measured parts and rights statement. Null for the rest.
 */
export function useCollectionFieldValue() {
  const dates = useProductionDateFormat();
  const description = useObjectDescriptionFormat();
  return useCallback(
    (field: string, value: unknown): string | null => {
      switch (field) {
        case "dateCreatedEdtf": {
          const draft = productionDateDraftSchema.safeParse(value);
          const date = draft.success
            ? productionDateFromDraft(draft.data)
            : null;
          return date ? dates.date(date) : null;
        }
        case "numberOfObjects":
          return describeObjectDescriptionValue(
            field,
            typeof value === "string"
              ? parseNumberOfObjects(value).value
              : value,
            description,
          );
        case "measurementSets": {
          const entries = measurementSetEntriesSchema.safeParse(value);
          return entries.success
            ? describeObjectDescriptionValue(
                field,
                measurementSetsFromEntries(entries.data),
                description,
              )
            : null;
        }
        default:
          return describeObjectDescriptionValue(field, value, description);
      }
    },
    [dates, description],
  );
}
