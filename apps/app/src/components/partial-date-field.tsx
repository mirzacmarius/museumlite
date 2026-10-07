"use client";

import { DatePicker } from "@v1/ui/date-picker";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import * as React from "react";
import { useI18n } from "@/locales/client";

interface PartialDateFieldProps {
  id?: string;
  label: string;
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

type Precision = "year" | "month" | "day";

function getPrecision(value?: string): Precision {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return "day";
  if (/^\d{4}-\d{2}$/.test(value ?? "")) return "month";
  return "year";
}

function getPickerDate(value?: string): Date | undefined {
  const match = value?.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
  if (!match) return undefined;
  const [, year, month = "01", day = "01"] = match;
  const date = new Date(0);
  date.setHours(0, 0, 0, 0);
  date.setFullYear(Number(year), Number(month) - 1, Number(day));
  return date;
}

function serializeDate(date: Date, precision: Precision): string {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  if (precision === "year") return year;
  if (precision === "month") return `${year}-${month}`;
  return `${year}-${month}-${day}`;
}

export function PartialDateField({
  id,
  label,
  value,
  onChange,
  disabled = false,
}: PartialDateFieldProps) {
  const translate = useI18n();
  const [precision, setPrecision] = React.useState<Precision>(() =>
    getPrecision(value),
  );
  const lastEmittedValue = React.useRef(value);
  React.useEffect(() => {
    if (value !== lastEmittedValue.current) {
      lastEmittedValue.current = value;
      setPrecision(getPrecision(value));
    }
  }, [value]);

  const storedPrecision = getPrecision(value);
  const anchorDate = getPickerDate(value);
  const dateIsPreciseEnough = Boolean(value) && precision === storedPrecision;
  const handleChange = (nextValue: string) => {
    lastEmittedValue.current = nextValue;
    onChange(nextValue);
  };

  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
        <DatePicker
          label={label}
          id={id}
          date={dateIsPreciseEnough ? anchorDate : undefined}
          defaultMonth={anchorDate}
          placeholder={translate("untranslatedComponents.labels.pickADate")}
          disabled={disabled}
          displayFormat={
            precision === "year"
              ? "yyyy"
              : precision === "month"
                ? "MMMM yyyy"
                : "PPP"
          }
          onSelect={(date) =>
            handleChange(date ? serializeDate(date, precision) : "")
          }
        />
        <div className="space-y-1">
          <Label
            htmlFor={id ? `${id}-precision` : undefined}
            className="text-xs text-muted-foreground"
          >
            {translate("untranslatedComponents.labels.precision")}
          </Label>
          <Select
            value={precision}
            disabled={disabled}
            onValueChange={(nextPrecision: Precision) => {
              setPrecision(nextPrecision);
              if (
                anchorDate &&
                { year: 1, month: 2, day: 3 }[nextPrecision] <=
                  { year: 1, month: 2, day: 3 }[storedPrecision]
              ) {
                handleChange(serializeDate(anchorDate, nextPrecision));
              }
            }}
          >
            <SelectTrigger id={id ? `${id}-precision` : undefined}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="year">
                {translate("untranslatedComponents.labels.year")}
              </SelectItem>
              <SelectItem value="month">
                {translate("untranslatedComponents.labels.month")}
              </SelectItem>
              <SelectItem value="day">
                {translate("untranslatedComponents.labels.day")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {!dateIsPreciseEnough && value && (
        <p className="text-xs text-muted-foreground">
          {translate(
            "untranslatedComponents.labels.chooseADateToAddTheSelectedPrecisionTheCurrentValueStaysUnchangedUntilThen",
          )}
        </p>
      )}
    </div>
  );
}
