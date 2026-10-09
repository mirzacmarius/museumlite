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
const QUALIFIERS: PartialDateQualifierChoice[] = [
  "exact",
  "circa",
  "notAfter",
  "notBefore",
];

interface PartialDateFieldsProps {
  id: string;
  label: string;
  value: PartialDateDraft;
  onChange: (value: PartialDateDraft) => void;
  disabled?: boolean;
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
}: PartialDateFieldsProps) {
  const t = useScopedI18n("provenance.dateInput");
  const update = (patch: Partial<PartialDateDraft>) =>
    onChange({ ...value, ...patch });
  const stated = value.precision !== "none";
  const showMonth = value.precision === "day" || value.precision === "month";

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
                {QUALIFIERS.map((qualifier) => (
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
