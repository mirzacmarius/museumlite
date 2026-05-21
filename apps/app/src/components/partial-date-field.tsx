"use client";

import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import * as React from "react";

interface PartialDateFieldProps {
  id?: string;
  label: string;
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

interface ParsedPartialDate {
  year: string;
  month: string;
  day: string;
}

const EMPTY_SELECT_VALUE = "__empty__";

const MONTH_OPTIONS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
] as const;

function parsePartialDate(value?: string): ParsedPartialDate {
  if (!value) {
    return { year: "", month: "", day: "" };
  }

  const fullDateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (fullDateMatch) {
    const [, year, month, day] = fullDateMatch;
    return {
      year: year ?? "",
      month: month ?? "",
      day: day ?? "",
    };
  }

  const yearMonthMatch = value.match(/^(\d{4})-(\d{2})$/);
  if (yearMonthMatch) {
    const [, year, month] = yearMonthMatch;
    return {
      year: year ?? "",
      month: month ?? "",
      day: "",
    };
  }

  const yearMatch = value.match(/^(\d{4})$/);
  if (yearMatch) {
    return {
      year: yearMatch[1] ?? "",
      month: "",
      day: "",
    };
  }

  return { year: "", month: "", day: "" };
}

function getDaysInMonth(year: string, month: string) {
  const numericYear = Number(year);
  const numericMonth = Number(month);

  if (
    !Number.isInteger(numericYear) ||
    !Number.isInteger(numericMonth) ||
    numericMonth < 1 ||
    numericMonth > 12
  ) {
    return 31;
  }

  return new Date(numericYear, numericMonth, 0).getDate();
}

function formatPartialDate({ year, month, day }: ParsedPartialDate): string {
  if (!year) {
    return "";
  }

  if (!month) {
    return year;
  }

  if (!day) {
    return `${year}-${month}`;
  }

  return `${year}-${month}-${day}`;
}

export function PartialDateField({
  id,
  label,
  value,
  onChange,
  disabled = false,
}: PartialDateFieldProps) {
  const { year, month, day } = parsePartialDate(value);
  const yearOptions = React.useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: currentYear - 1499 }, (_, index) => {
      const nextYear = String(currentYear - index);
      return { value: nextYear, label: nextYear };
    });
  }, []);

  const dayOptions = React.useMemo(() => {
    const daysInMonth = getDaysInMonth(year, month);
    return Array.from({ length: daysInMonth }, (_, index) => {
      const nextDay = String(index + 1).padStart(2, "0");
      return { value: nextDay, label: String(index + 1) };
    });
  }, [month, year]);

  const handleYearChange = (nextYear: string) => {
    const normalizedYear = nextYear === EMPTY_SELECT_VALUE ? "" : nextYear;
    const normalizedMonth = normalizedYear ? month : "";
    const normalizedDay = normalizedYear ? day : "";

    onChange(
      formatPartialDate({
        year: normalizedYear,
        month: normalizedMonth,
        day: normalizedDay,
      }),
    );
  };

  const handleMonthChange = (nextMonth: string) => {
    const normalizedMonth = nextMonth === EMPTY_SELECT_VALUE ? "" : nextMonth;

    if (
      day &&
      normalizedMonth &&
      Number(day) > getDaysInMonth(year, normalizedMonth)
    ) {
      onChange(
        formatPartialDate({
          year,
          month: normalizedMonth,
          day: "",
        }),
      );
      return;
    }

    onChange(
      formatPartialDate({
        year,
        month: normalizedMonth,
        day: normalizedMonth ? day : "",
      }),
    );
  };

  const handleDayChange = (nextDay: string) => {
    const normalizedDay = nextDay === EMPTY_SELECT_VALUE ? "" : nextDay;
    onChange(
      formatPartialDate({
        year,
        month,
        day: normalizedDay,
      }),
    );
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="grid gap-3 sm:grid-cols-3">
        <Select
          disabled={disabled}
          value={year || undefined}
          onValueChange={handleYearChange}
        >
          <SelectTrigger id={id}>
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY_SELECT_VALUE}>Year not known</SelectItem>
            {yearOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          disabled={disabled || !year}
          value={month || undefined}
          onValueChange={handleMonthChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY_SELECT_VALUE}>Month not known</SelectItem>
            {MONTH_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          disabled={disabled || !year || !month}
          value={day || undefined}
          onValueChange={handleDayChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Day" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY_SELECT_VALUE}>Day not known</SelectItem>
            {dayOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
