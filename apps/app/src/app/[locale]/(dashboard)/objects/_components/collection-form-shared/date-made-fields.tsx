"use client";

import {
  formatEdtf,
  type ProductionDate,
  productionYears,
  readDateText,
} from "@v1/backend/convex/utils/productionDates";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { useMemo } from "react";
import { EdtfChip } from "@/components/production-date/edtf-chip";
import {
  EMPTY_PRODUCTION_DATE_DRAFT,
  type ProductionDateDraft,
  productionDateFromDraft,
  sameProductionYears,
} from "@/components/production-date/production-date-draft";
import { useProductionDateFormat } from "@/components/production-date/use-production-date-format";
import {
  FieldError,
  fieldErrorId,
} from "@/components/record-form/record-form-notices";
import { useI18n, useScopedI18n } from "@/locales/client";
import { type CollectionFormTabProps, NO_FIELD_ERRORS } from "./types";

const READING_ID = "dateCreated-reading";

type DateMadeFieldsProps = Pick<
  CollectionFormTabProps,
  "formData" | "updateField" | "placeholders" | "fieldErrors"
>;

/**
 * The date made as staff write it, and what the catalog reads it as for
 * sorting, filters and exports. The form has no structured date field any
 * more (MUS-867): a structured date saved earlier or imported is kept as it
 * is and counts instead of the text, as shown here. Where the text reads as
 * another date, staff can drop the structured date so the text counts.
 */
export function DateMadeFields({
  formData,
  updateField,
  placeholders,
  fieldErrors = NO_FIELD_ERRORS,
}: DateMadeFieldsProps) {
  const tRoot = useI18n();
  const error = fieldErrors.dateCreatedEdtf;
  return (
    <div className="space-y-2 md:col-span-2 xl:col-span-3">
      <Label htmlFor="dateCreated">{tRoot("objects.form.dateCreated")}</Label>
      <Input
        id="dateCreated"
        value={formData.dateCreated || ""}
        onChange={(event) => updateField("dateCreated", event.target.value)}
        placeholder={placeholders("dateCreated")}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          error
            ? `${READING_ID} ${fieldErrorId("dateCreatedEdtf")}`
            : READING_ID
        }
      />
      <DateTextReading
        text={formData.dateCreated}
        draft={formData.dateCreatedEdtf}
        onUseText={() => {
          updateField("dateCreatedEdtf", EMPTY_PRODUCTION_DATE_DRAFT);
          // The button goes with the notice; keep focus on the date.
          document.getElementById("dateCreated")?.focus();
        }}
      />
      <FieldError field="dateCreatedEdtf" message={error} />
    </div>
  );
}

/**
 * What the text reads as, with the parser the catalog sorts and filters by,
 * so staff see the years before they save; or the structured date that
 * counts instead.
 */
function DateTextReading({
  text,
  draft,
  onUseText,
}: {
  text: string | undefined;
  draft: ProductionDateDraft | undefined;
  onUseText: () => void;
}) {
  const reading = useMemo(() => readDateText(text), [text]);
  const structured = productionDateFromDraft(draft);
  return (
    <div
      id={READING_ID}
      aria-live="polite"
      className="space-y-1 text-xs text-muted-foreground"
    >
      {structured ? (
        <>
          {reading && !sameProductionYears(reading, structured) ? (
            <ReadingMismatch
              reading={reading}
              structured={structured}
              onUseText={onUseText}
            />
          ) : null}
          <SortedBy date={structured} />
        </>
      ) : reading ? (
        <SortedBy date={reading} readAs />
      ) : text?.trim() ? (
        <NotRead />
      ) : null}
    </div>
  );
}

/** The years a date sorts and filters by, and its EDTF. */
function SortedBy({
  date,
  readAs = false,
}: {
  date: ProductionDate;
  readAs?: boolean;
}) {
  const t = useScopedI18n("objects.form.productionDate");
  const dates = useProductionDateFormat();
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span>
        {readAs ? `${t("readAs", { date: dates.date(date) })} ` : null}
        {dates.years(productionYears(date))}
      </span>
      <EdtfChip edtf={formatEdtf(date)} />
    </div>
  );
}

function ReadingMismatch({
  reading,
  structured,
  onUseText,
}: {
  reading: ProductionDate;
  structured: ProductionDate;
  onUseText: () => void;
}) {
  const t = useScopedI18n("objects.form.productionDate");
  const dates = useProductionDateFormat();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <p className="text-status-warning-foreground">
        {t("mismatch", {
          text: dates.date(reading),
          date: dates.date(structured),
        })}
      </p>
      <Button type="button" variant="outline" size="sm" onClick={onUseText}>
        {t("useText")}
      </Button>
    </div>
  );
}

function NotRead() {
  const t = useScopedI18n("objects.form.productionDate");
  return <p>{t("notRead")}</p>;
}
