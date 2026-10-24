"use client";

import { Checkbox } from "@v1/ui/checkbox";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { useScopedI18n } from "@/locales/client";
import type {
  PartialDateDraft,
  PartialDateEra,
  PartialDatePrecisionChoice,
  PartialDateQualifierChoice,
} from "./historical-date";

const PRECISIONS: PartialDatePrecisionChoice[] = [
  "none",
  "day",
  "month",
  "year",
  "decade",
];
const QUALIFIERS: readonly PartialDateQualifierChoice[] = [
  "exact",
  "circa",
  "notAfter",
  "notBefore",
];
const ERAS: readonly PartialDateEra[] = ["ad", "bc"];

interface PartialDateFieldsProps {
  id: string;
  label: string;
  value: PartialDateDraft;
  onChange: (value: PartialDateDraft) => void;
  disabled?: boolean;
  /** The qualifiers offered; all four by default. */
  qualifiers?: readonly PartialDateQualifierChoice[];
  /** Offers an AD/BC era for a year. Off for provenance claims. */
  allowBc?: boolean;
}

/**
 * One historical date entered only as precisely as the source gives it.
 * "Not stated" leaves the date out; nothing is filled in.
 */
export function PartialDateFields({
  id,
  label,
  value,
  onChange,
  disabled = false,
  qualifiers = QUALIFIERS,
  allowBc = false,
}: PartialDateFieldsProps) {
  const t = useScopedI18n("provenance.dateInput");
  const update = (patch: Partial<PartialDateDraft>) =>
    onChange({ ...value, ...patch });
  const stated = value.precision !== "none";

  return (
    <fieldset className="space-y-2 rounded-lg border border-border/60 p-3">
      <legend className="px-1 text-sm font-medium">{label}</legend>
      <div className="grid gap-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-precision`} className="text-xs">
            {t("precision")}
          </Label>
          <Select
            value={value.precision}
            disabled={disabled}
            onValueChange={(precision) =>
              update({ precision: precision as PartialDatePrecisionChoice })
            }
          >
            <SelectTrigger id={`${id}-precision`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRECISIONS.map((precision) => (
                <SelectItem key={precision} value={precision}>
                  {t(`precisions.${precision}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {stated ? (
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-qualifier`} className="text-xs">
              {t("qualifier")}
            </Label>
            <Select
              value={value.qualifier}
              disabled={disabled}
              onValueChange={(qualifier) =>
                update({ qualifier: qualifier as PartialDateQualifierChoice })
              }
            >
              <SelectTrigger id={`${id}-qualifier`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {qualifiers.map((qualifier) => (
                  <SelectItem key={qualifier} value={qualifier}>
                    {t(`qualifiers.${qualifier}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>
      {stated ? (
        <>
          <PartialDateParts
            id={id}
            value={value}
            update={update}
            disabled={disabled}
            showEra={allowBc && value.precision === "year"}
          />
          {value.precision === "decade" ? (
            <p className="text-xs text-muted-foreground">{t("decadeHint")}</p>
          ) : null}
          <div className="flex items-center gap-2">
            <Checkbox
              id={`${id}-uncertain`}
              checked={value.uncertain}
              disabled={disabled}
              onCheckedChange={(checked) =>
                update({ uncertain: checked === true })
              }
            />
            <Label htmlFor={`${id}-uncertain`} className="text-xs font-normal">
              {t("uncertain")}
            </Label>
          </div>
        </>
      ) : null}
    </fieldset>
  );
}

/** The year, month and day the precision asks for, and a year's era. */
function PartialDateParts({
  id,
  value,
  update,
  disabled,
  showEra,
}: {
  id: string;
  value: PartialDateDraft;
  update: (patch: Partial<PartialDateDraft>) => void;
  disabled: boolean;
  showEra: boolean;
}) {
  const t = useScopedI18n("provenance.dateInput");
  const showMonth = value.precision === "day" || value.precision === "month";
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-year`} className="text-xs">
          {t("year")}
        </Label>
        <Input
          id={`${id}-year`}
          inputMode="numeric"
          value={value.year}
          disabled={disabled}
          onChange={(event) => update({ year: event.target.value })}
        />
      </div>
      {showEra ? (
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor={`${id}-era`} className="text-xs">
            {t("era")}
          </Label>
          <Select
            value={value.era ?? "ad"}
            disabled={disabled}
            onValueChange={(era) => update({ era: era === "bc" ? "bc" : "ad" })}
          >
            <SelectTrigger id={`${id}-era`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ERAS.map((era) => (
                <SelectItem key={era} value={era}>
                  {t(`eras.${era}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {showMonth ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-month`} className="text-xs">
            {t("month")}
          </Label>
          <Input
            id={`${id}-month`}
            inputMode="numeric"
            value={value.month}
            disabled={disabled}
            onChange={(event) => update({ month: event.target.value })}
          />
        </div>
      ) : null}
      {value.precision === "day" ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-day`} className="text-xs">
            {t("day")}
          </Label>
          <Input
            id={`${id}-day`}
            inputMode="numeric"
            value={value.day}
            disabled={disabled}
            onChange={(event) => update({ day: event.target.value })}
          />
        </div>
      ) : null}
    </div>
  );
}
