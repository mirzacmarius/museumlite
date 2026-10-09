"use client";

import type { ObjectDraftTypeDetails } from "@v1/backend/convex/utils/collectionTypeDetailFields";
import { formatDate } from "@/lib/format-date";
import { useCurrentLocale, useI18n } from "@/locales/client";
import type { TypeDetailFieldValue } from "./type-detail-values";
import {
  type TypeDetailFieldSpec,
  useCollectionModuleLabels,
  useTypeDetailFieldSpecs,
} from "./use-type-detail-field-specs";

const fractionDigits = { maximumFractionDigits: 6 };
const DETAIL_NUMBER_FORMATS = {
  en: new Intl.NumberFormat("en", fractionDigits),
  es: new Intl.NumberFormat("es", fractionDigits),
  fr: new Intl.NumberFormat("fr", fractionDigits),
  no: new Intl.NumberFormat("nb-NO", fractionDigits),
  ro: new Intl.NumberFormat("ro", fractionDigits),
};

function formatFieldValue(
  spec: TypeDetailFieldSpec,
  value: TypeDetailFieldValue,
  locale: keyof typeof DETAIL_NUMBER_FORMATS,
  booleanLabels: { yes: string; no: string },
) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") {
    return value ? booleanLabels.yes : booleanLabels.no;
  }
  if (typeof value === "number") {
    if (spec.kind === "year") return String(value);
    if (spec.kind === "date") {
      return formatDate(new Date(value), locale, { dateStyle: "medium" });
    }
    return DETAIL_NUMBER_FORMATS[locale].format(value);
  }
  return spec.kind === "select" ? (spec.options[value] ?? value) : value;
}

/** Read-only list of the type-specific details recorded on a draft. */
export function TypeDetailsSummary({
  typeDetails,
}: {
  typeDetails: ObjectDraftTypeDetails;
}) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const typeLabels = useCollectionModuleLabels();
  const { fieldSpecs, booleanLabels } = useTypeDetailFieldSpecs();
  const values: Partial<Record<string, TypeDetailFieldValue>> =
    typeDetails.fields;
  const entries = Object.entries(
    fieldSpecs[typeDetails.collectionType],
  ).flatMap(([name, spec]) => {
    const value = values[name];
    return value === undefined ? [] : [{ name, spec, value }];
  });

  if (entries.length === 0) return null;

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-foreground">
        {t("objectTypeDetails.summary.title", {
          type: typeLabels[typeDetails.collectionType],
        })}
      </p>
      <dl className="grid gap-4 md:grid-cols-3">
        {entries.map(({ name, spec, value }) => (
          <div key={name} className="space-y-1.5">
            <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {spec.label}
            </dt>
            <dd className="whitespace-pre-wrap text-sm leading-6 text-foreground">
              {formatFieldValue(spec, value, locale, booleanLabels)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
