"use client";

import { format, parseISO } from "date-fns";
import * as React from "react";
import { useUiLocale } from "../locale";
import { cn } from "../utils";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Field, FieldLabel } from "./field";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

interface DatePickerProps
  extends Pick<React.AriaAttributes, "aria-invalid" | "aria-describedby"> {
  id?: string;
  label: React.ReactNode;
  date?: Date;
  onSelect?: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  displayFormat?: string;
  defaultMonth?: Date;
  /** Last month the calendar can show; defaults to the end of this year. */
  endMonth?: Date;
}

export function DatePicker({
  id,
  label,
  date,
  onSelect,
  placeholder,
  disabled,
  className,
  displayFormat,
  defaultMonth,
  endMonth,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: DatePickerProps) {
  const { locale, dateFnsLocale, messages } = useUiLocale();
  const [open, setOpen] = React.useState(false);
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const labelId = `${inputId}-label`;
  const valueId = `${inputId}-value`;

  return (
    <Field className={cn("mx-auto w-44", className)}>
      <FieldLabel id={labelId} htmlFor={inputId}>
        {label}
      </FieldLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {/* Named by the label and the date shown, so the value is read too. */}
          <Button
            variant="outline"
            id={inputId}
            type="button"
            aria-labelledby={`${labelId} ${valueId}`}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            className="justify-start font-normal"
            disabled={disabled}
          >
            <span id={valueId}>
              {date
                ? displayFormat
                  ? format(date, displayFormat, { locale: dateFnsLocale })
                  : date.toLocaleDateString(locale)
                : (placeholder ?? messages.datePicker.placeholder)}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          {/* Starts on the chosen day (or today) so the arrow keys pick a date. */}
          <Calendar
            mode="single"
            autoFocus
            selected={date}
            defaultMonth={defaultMonth ?? date}
            endMonth={endMonth}
            captionLayout="dropdown"
            onSelect={(date) => {
              onSelect?.(date);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </Field>
  );
}

interface DatePickerInputProps
  extends Omit<DatePickerProps, "date" | "onSelect"> {
  value?: string;
  onChange?: (value: string) => void;
}

export function DatePickerInput({
  value,
  onChange,
  ...props
}: DatePickerInputProps) {
  const parsedDate = value ? parseISO(value) : undefined;
  const date =
    parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : undefined;

  return (
    <DatePicker
      {...props}
      date={date}
      onSelect={(date) => onChange?.(date ? format(date, "yyyy-MM-dd") : "")}
    />
  );
}
