"use client";

import { Button } from "@v1/ui/button";
import { Calendar } from "@v1/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { format, isValid, parseISO } from "date-fns";
import * as React from "react";
import { cn } from "../utils";

interface DatePickerProps {
  id?: string;
  date?: Date;
  onSelect?: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  displayFormat?: string;
  defaultMonth?: Date;
}

interface DatePickerInputProps {
  id?: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function monthAtYear(year: number): Date {
  const date = new Date(0);
  date.setFullYear(year, 0, 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function DatePicker({
  id,
  date,
  onSelect,
  placeholder = "Select date",
  disabled = false,
  className,
  displayFormat,
  defaultMonth,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const startMonth =
    date && date < monthAtYear(1500) ? date : monthAtYear(1500);
  const nextCentury = new Date(new Date().getFullYear() + 100, 11, 31);
  const endMonth = date && date > nextCentury ? date : nextCentury;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className,
          )}
        >
          {date
            ? displayFormat
              ? format(date, displayFormat)
              : date.toLocaleDateString()
            : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(selectedDate) => {
            onSelect?.(selectedDate);
            setOpen(false);
          }}
          defaultMonth={defaultMonth ?? date}
          captionLayout="dropdown"
          startMonth={startMonth}
          endMonth={endMonth}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Adapts the yyyy-MM-dd form value convention to the shared calendar picker. */
export function DatePickerInput({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: DatePickerInputProps) {
  const parsedDate = value ? parseISO(value) : undefined;
  const date = parsedDate && isValid(parsedDate) ? parsedDate : undefined;

  return (
    <DatePicker
      id={id}
      date={date}
      onSelect={(selectedDate) =>
        onChange(selectedDate ? format(selectedDate, "yyyy-MM-dd") : "")
      }
      placeholder={placeholder}
      disabled={disabled}
      className={className}
    />
  );
}
