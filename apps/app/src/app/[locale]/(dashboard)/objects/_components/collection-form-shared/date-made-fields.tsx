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
  draftFromProductionDate,
  EMPTY_PRODUCTION_DATE_DRAFT,
  type ProductionDateDraft,
  productionDateFromDraft,
  RANGE_SIDE_QUALIFIERS,
  sameProductionYears,
} from "@/components/production-date/production-date-draft";
import { useProductionDateFormat } from "@/components/production-date/use-production-date-format";
import { PartialDateFields } from "@/components/provenance/partial-date-fields";
import {
  FieldError,
  fieldErrorProps,
} from "@/components/record-form/record-form-notices";
import { useI18n, useScopedI18n } from "@/locales/client";
import { STRUCTURED_DATE_MADE_ID } from "./constants";
import { type CollectionFormTabProps, NO_FIELD_ERRORS } from "./types";

const READING_ID = "dateCreated-reading";
const CLEAR_ID = `${STRUCTURED_DATE_MADE_ID}-clear`;

/**
 * Keeps keyboard focus on the structured date after a button that removes
 * itself sets or clears it: From's precision, or Clear for a fixed date.
 */
function focusStructuredDate() {
  requestAnimationFrame(() =>
    (
      document.getElementById(`${STRUCTURED_DATE_MADE_ID}-from-precision`) ??
      document.getElementById(CLEAR_ID)
    )?.focus(),
  );
}

type DateMadeFieldsProps = Pick<
  CollectionFormTabProps,
  "formData" | "updateField" | "placeholders" | "fieldErrors"
>;

/**
 * The date made as staff write it, what the catalog reads it as, and an
 * optional structured date that sorting, filters and exports use instead.
 */
export function DateMadeFields({
  formData,
  updateField,
  placeholders,
  fieldErrors = NO_FIELD_ERRORS,
}: DateMadeFieldsProps) {
  const tRoot = useI18n();
  const draft = formData.dateCreatedEdtf ?? EMPTY_PRODUCTION_DATE_DRAFT;
  const setDraft = (next: ProductionDateDraft) =>
    updateField("dateCreatedEdtf", next);
  return (
    <div className="space-y-3 md:col-span-2 xl:col-span-3">
      <div className="space-y-2">
        <Label htmlFor="dateCreated">{tRoot("objects.form.dateCreated")}</Label>
        <Input
          id="dateCreated"
          value={formData.dateCreated || ""}
          onChange={(event) => updateField("dateCreated", event.target.value)}
          placeholder={placeholders("dateCreated")}
          aria-describedby={READING_ID}
        />
        <DateTextReading
          text={formData.dateCreated}
          draft={draft}
          onUseReading={setDraft}
        />
      </div>
      <StructuredDateFields
        draft={draft}
        onChange={setDraft}
        error={fieldErrors.dateCreatedEdtf}
      />
    </div>
  );
}

/**
 * What the text reads as, with the parser the catalog sorts and filters by,
 * so staff see the years before they save.
 */
function DateTextReading({
  text,
  draft,
  onUseReading,
}: {
  text: string | undefined;
  draft: ProductionDateDraft;
  onUseReading: (draft: ProductionDateDraft) => void;
}) {
  const reading = useMemo(() => readDateText(text), [text]);
  const structured = productionDateFromDraft(draft);
  return (
    <div
      id={READING_ID}
      aria-live="polite"
      className="text-xs text-muted-foreground"
    >
      {reading && structured === undefined ? (
        <ReadAs reading={reading} onUseReading={onUseReading} />
      ) : null}
      {reading && structured && !sameProductionYears(reading, structured) ? (
        <ReadingMismatch reading={reading} structured={structured} />
      ) : null}
      {!reading && text?.trim() && structured === undefined ? (
        <NotRead />
      ) : null}
    </div>
  );
}

function ReadAs({
  reading,
  onUseReading,
}: {
  reading: ProductionDate;
  onUseReading: (draft: ProductionDateDraft) => void;
}) {
  const t = useScopedI18n("objects.form.productionDate");
  const dates = useProductionDateFormat();
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span>
        {t("readAs", { date: dates.date(reading) })}{" "}
        {dates.years(productionYears(reading))}
      </span>
      <EdtfChip edtf={formatEdtf(reading)} />
      <Button
        type="button"
        variant="outline"
        size="xs"
        className="h-auto min-h-6 whitespace-normal py-1 text-left"
        onClick={() => {
          onUseReading(draftFromProductionDate(reading));
          focusStructuredDate();
        }}
      >
        {t("useReading")}
      </Button>
    </div>
  );
}

function ReadingMismatch({
  reading,
  structured,
}: {
  reading: ProductionDate;
  structured: ProductionDate;
}) {
  const t = useScopedI18n("objects.form.productionDate");
  const dates = useProductionDateFormat();
  return (
    <p className="text-status-warning-foreground">
      {t("mismatch", {
        text: dates.date(reading),
        date: dates.date(structured),
      })}
    </p>
  );
}

function NotRead() {
  const t = useScopedI18n("objects.form.productionDate");
  return <p>{t("notRead")}</p>;
}

/** The From and To dates, or a fixed EDTF date they cannot show. */
function StructuredDateFields({
  draft,
  onChange,
  error,
}: {
  draft: ProductionDateDraft;
  onChange: (draft: ProductionDateDraft) => void;
  error: string | undefined;
}) {
  const t = useScopedI18n("objects.form.productionDate");
  const dates = useProductionDateFormat();
  const date = productionDateFromDraft(draft);
  const errorProps = fieldErrorProps("dateCreatedEdtf", error);
  return (
    <fieldset className="space-y-3 rounded-lg border border-border/60 p-3 sm:p-4">
      <legend className="px-1 text-sm font-medium">{t("legend")}</legend>
      <p className="text-xs text-muted-foreground">{t("description")}</p>
      {draft.fixedEdtf === undefined ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <PartialDateFields
              id={`${STRUCTURED_DATE_MADE_ID}-from`}
              label={t("from")}
              value={draft.from}
              onChange={(from) => onChange({ ...draft, from })}
              allowBc
              errorProps={errorProps}
            />
            <PartialDateFields
              id={`${STRUCTURED_DATE_MADE_ID}-to`}
              label={t("to")}
              value={draft.to}
              onChange={(to) => onChange({ ...draft, to })}
              qualifiers={RANGE_SIDE_QUALIFIERS}
              allowBc
              errorProps={errorProps}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("hint")}</p>
        </>
      ) : (
        <div className="space-y-1">
          <p className="text-sm text-foreground">
            {date ? dates.date(date) : draft.fixedEdtf}
          </p>
          <p className="text-xs text-muted-foreground">{t("fixed")}</p>
        </div>
      )}
      <StructuredDateSummary
        date={date ?? undefined}
        canClear={
          draft.fixedEdtf !== undefined ||
          draft.from.precision !== "none" ||
          draft.to.precision !== "none"
        }
        onClear={() => {
          onChange(EMPTY_PRODUCTION_DATE_DRAFT);
          focusStructuredDate();
        }}
      />
      <FieldError field="dateCreatedEdtf" message={error} />
    </fieldset>
  );
}

/** The years the structured date sorts by, its EDTF, and a way to clear it. */
function StructuredDateSummary({
  date,
  canClear,
  onClear,
}: {
  date: ProductionDate | undefined;
  canClear: boolean;
  onClear: () => void;
}) {
  const t = useScopedI18n("objects.form.productionDate");
  const dates = useProductionDateFormat();
  if (!date && !canClear) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      {date ? (
        <>
          <span>{dates.years(productionYears(date))}</span>
          <EdtfChip edtf={formatEdtf(date)} />
        </>
      ) : null}
      {canClear ? (
        <Button
          id={CLEAR_ID}
          type="button"
          variant="outline"
          size="xs"
          className="h-auto min-h-6 whitespace-normal py-1 text-left"
          onClick={onClear}
        >
          {t("clear")}
        </Button>
      ) : null}
    </div>
  );
}
