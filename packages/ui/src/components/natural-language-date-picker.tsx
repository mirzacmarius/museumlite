"use client";

import { parseDate } from "chrono-node";
import { format, parseISO } from "date-fns";
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
  return format(date, "MMMM dd, yyyy");
}

function isValidDate(date: Date | undefined) {
  if (!date) {
    return false;
  }
  return !Number.isNaN(date.getTime());
}

function parseStoredDate(value: string | undefined) {
  if (!value) {
    return undefined;
  }
  const parsedDate = parseISO(value);
  return isValidDate(parsedDate) ? parsedDate : undefined;
}

function toDateString(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function getInitialPickerState(
  value: string | undefined,
  defaultDate: Date | undefined,
) {
  const parsedDate = parseStoredDate(value);
  if (parsedDate) {
    return {
      open: false,
      inputValue: formatDate(parsedDate),
      date: parsedDate,
      month: parsedDate,
    };
  }

  if (defaultDate) {
    return {
      open: false,
      inputValue: formatDate(defaultDate),
      date: defaultDate,
      month: defaultDate,
    };
  }

  return {
    open: false,
    inputValue: "",
    date: undefined,
    month: undefined,
  };
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

interface PickerState {
  open: boolean;
  inputValue: string;
  date: Date | undefined;
  month: Date | undefined;
}

type PickerAction =
  | { type: "setOpen"; value: boolean }
  | { type: "setInputValue"; value: string }
  | { type: "setDate"; value: Date | undefined }
  | { type: "setMonth"; value: Date | undefined }
  | { type: "applyParsedInput"; value: string }
  | { type: "selectCalendarDate"; value: Date };

function pickerReducer(state: PickerState, action: PickerAction): PickerState {
  switch (action.type) {
    case "setOpen":
      return { ...state, open: action.value };
    case "setInputValue":
      return { ...state, inputValue: action.value };
    case "setDate":
      return { ...state, date: action.value };
    case "setMonth":
      return { ...state, month: action.value };
    case "applyParsedInput": {
      const newValue = action.value;
      if (!newValue.trim()) {
        return { ...state, inputValue: newValue, date: undefined };
      }
      const parsedDate = parseDate(newValue);
      if (parsedDate && isValidDate(parsedDate)) {
        return {
          ...state,
          inputValue: newValue,
          date: parsedDate,
          month: parsedDate,
        };
      }
      return { ...state, inputValue: newValue };
    }
    case "selectCalendarDate":
      return {
        ...state,
        date: action.value,
        month: action.value,
        inputValue: formatDate(action.value),
        open: false,
      };
  }
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
  return (
    <NaturalLanguageDatePickerInner
      key={`${value ?? ""}:${defaultDate?.getTime() ?? ""}`}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      id={id}
      required={required}
      defaultDate={defaultDate}
    />
  );
}

function NaturalLanguageDatePickerInner({
  value: _value,
  onChange,
  placeholder = "today",
  disabled,
  className,
  id,
  required = false,
  defaultDate,
}: NaturalLanguageDatePickerProps) {
  const [state, dispatch] = React.useReducer(
    pickerReducer,
    { value: _value, defaultDate },
    ({ value, defaultDate: fallbackDate }) =>
      getInitialPickerState(value, fallbackDate),
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    dispatch({ type: "applyParsedInput", value: newValue });

    if (!newValue.trim()) {
      onChange?.("");
      return;
    }

    const parsedDate = parseDate(newValue);
    if (parsedDate && isValidDate(parsedDate)) {
      onChange?.(toDateString(parsedDate));
    }
  };

  const handleCalendarSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      dispatch({ type: "selectCalendarDate", value: selectedDate });
      onChange?.(toDateString(selectedDate));
    }
  };

  return (
    <div className="relative">
      <Input
        id={id}
        value={state.inputValue}
        placeholder={placeholder}
        className={`bg-background pr-10 ${className || ""}`}
        onChange={handleInputChange}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            dispatch({ type: "setOpen", value: true });
          }
        }}
        disabled={disabled}
        required={required}
      />
      <Popover
        open={state.open}
        onOpenChange={(nextOpen) =>
          dispatch({ type: "setOpen", value: nextOpen })
        }
      >
        <PopoverTrigger asChild>
          <Button
            id={`${id}-picker`}
            variant="ghost"
            className="absolute top-1/2 right-2 size-6 -translate-y-1/2 p-0 size-6"
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
            selected={state.date}
            captionLayout="dropdown"
            month={state.month}
            onMonthChange={(nextMonth) =>
              dispatch({ type: "setMonth", value: nextMonth })
            }
            onSelect={handleCalendarSelect}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
