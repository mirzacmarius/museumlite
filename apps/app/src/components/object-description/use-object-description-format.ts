import { useMemo } from "react";
import { useRightsStatementName } from "@/components/rights-statement/use-rights-statement-name";
import { formatNumber } from "@/lib/format-number";
import type { ObjectDescriptionFormat } from "@/lib/object-description-format";
import { useCurrentLocale, useI18n } from "@/locales/client";

/**
 * Names of measured parts, completeness values and rights statements, and
 * measurement abbreviations and numbers, in the app language.
 */
export function useObjectDescriptionFormat(): ObjectDescriptionFormat {
  const tRoot = useI18n();
  const locale = useCurrentLocale();
  const rightsStatement = useRightsStatementName();
  return useMemo(
    () => ({
      measurements: {
        labels: {
          height: tRoot("objects.objectIdSheet.measurement.height"),
          width: tRoot("objects.objectIdSheet.measurement.width"),
          depth: tRoot("objects.objectIdSheet.measurement.depth"),
        },
        number: (value) => formatNumber(value, locale),
        part: (part) => tRoot(`objectDescription.parts.${part}`),
      },
      completeness: (value) => tRoot(`objectDescription.completeness.${value}`),
      rightsStatement,
    }),
    [locale, rightsStatement, tRoot],
  );
}
