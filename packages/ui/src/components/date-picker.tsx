"use client";

import { format, parseISO } from "date-fns";
import * as React from "react";
import { useUiLocale } from "../locale";
import { cn } from "../utils";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Field, FieldLabel } from "./field";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

interface DatePickerProps {
  id?: string;
  label: React.ReactNode;
  date?: Date;
  onSelect?: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  displayFormat?: string;
  defaultMonth?: Date;
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
}: DatePickerProps) {
  const { locale, dateFnsLocale, messages } = useUiLocale();
  const [open, setOpen] = React.useState(false);
  const generatedId = React.useId();
  const inputId = id ?? generatedId;

  return (
    <Field className={cn("mx-auto w-44", className)}>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            id={inputId}
            type="button"
            className="justify-start font-normal"
            disabled={disabled}
          >
            {date
              ? displayFormat
                ? format(date, displayFormat, { locale: dateFnsLocale })
                : date.toLocaleDateString(locale)
              : (placeholder ?? messages.datePicker.placeholder)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            defaultMonth={defaultMonth ?? date}
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
