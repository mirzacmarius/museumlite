"use client";

import { parseDate } from "chrono-node";
import { CalendarIcon } from "lucide-react";
import * as React from "react";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

function formatDate(date: Date | undefined) {
  if (!date) {
    return "";
  }

  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function isValidDate(date: Date | undefined) {
  if (!date) {
    return false;
  }
  return !Number.isNaN(date.getTime());
}

interface NaturalLanguageDatePickerProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  required?: boolean;
  defaultDate?: Date;
}

export function NaturalLanguageDatePicker({
  value,
  onChange,
  placeholder = "today",
  disabled,
  className,
  id,
  required = false,
  defaultDate,
}: NaturalLanguageDatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(
    value
      ? formatDate(new Date(value))
      : defaultDate
        ? formatDate(defaultDate)
        : "",
  );
  const [date, setDate] = React.useState<Date | undefined>(
    value ? new Date(value) : defaultDate,
  );
  const [month, setMonth] = React.useState<Date | undefined>(
    date || defaultDate,
  );

  // Sync date with value prop changes
  React.useEffect(() => {
    if (value) {
      const newDate = new Date(value);
      if (isValidDate(newDate)) {
        setDate(newDate);
        setMonth(newDate);
        setInputValue(formatDate(newDate));
      }
    } else {
      // Show defaultDate in UI but don't auto-set value
      if (defaultDate) {
        setDate(defaultDate);
        setMonth(defaultDate);
        setInputValue(formatDate(defaultDate));
      } else {
        setDate(undefined);
        setInputValue("");
      }
    }
  }, [value, defaultDate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    if (newValue.trim()) {
      const parsedDate = parseDate(newValue);
      if (parsedDate && isValidDate(parsedDate)) {
        setDate(parsedDate);
        setMonth(parsedDate);
        onChange?.(parsedDate.toISOString().split("T")[0] ?? "");
      }
    } else {
      setDate(undefined);
      onChange?.("");
    }
  };

  const handleCalendarSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      setDate(selectedDate);
      setInputValue(formatDate(selectedDate));
      onChange?.(selectedDate.toISOString().split("T")[0] ?? "");
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <Input
        id={id}
        value={inputValue}
        placeholder={placeholder}
        className={`bg-background pr-10 ${className || ""}`}
        onChange={handleInputChange}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        disabled={disabled}
        required={required}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={`${id}-picker`}
            variant="ghost"
            className="absolute top-1/2 right-2 size-6 -translate-y-1/2 p-0 h-6 w-6"
            type="button"
          >
            <CalendarIcon className="size-3.5" />
            <span className="sr-only">Select date</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto overflow-hidden p-0"
          align="end"
          alignOffset={-8}
          sideOffset={10}
        >
          <Calendar
            mode="single"
            selected={date}
            captionLayout="dropdown"
            month={month}
            onMonthChange={setMonth}
            onSelect={handleCalendarSelect}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
