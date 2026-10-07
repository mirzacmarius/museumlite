"use client";

import {
  addDays,
  format,
  isValid,
  parse,
  parseISO,
  startOfDay,
} from "date-fns";
import { enUS, es, fr, nb, ro } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import * as React from "react";
import { type UiLocale, useUiLocale } from "../locale";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export function formatLocalizedDate(date: Date | undefined, locale: UiLocale) {
  if (!date) {
    return "";
  }
  const localeMap = { en: enUS, fr, es, no: nb, ro };
  return format(date, "PPP", { locale: localeMap[locale] });
}

function isValidDate(date: Date | undefined) {
  if (!date) {
    return false;
  }
  return !Number.isNaN(date.getTime());
}

export function parseLocalizedDate(
  value: string,
  locale: UiLocale,
  referenceDate = new Date(),
): Date | null {
  const normalizedValue = value.trim().toLocaleLowerCase(locale);
  const relativeDays: Record<UiLocale, Record<string, number>> = {
    en: { today: 0, tomorrow: 1, yesterday: -1 },
    fr: { "aujourd’hui": 0, "aujourd'hui": 0, demain: 1, hier: -1 },
    es: { hoy: 0, mañana: 1, ayer: -1 },
    no: { "i dag": 0, idag: 0, "i morgen": 1, "i går": -1, igår: -1 },
    ro: { astăzi: 0, azi: 0, mâine: 1, ieri: -1 },
  };
  const relativeDay = relativeDays[locale][normalizedValue];
  if (relativeDay !== undefined) {
    return addDays(startOfDay(referenceDate), relativeDay);
  }
  const isoDate = parseISO(value);
  if (isValid(isoDate)) return isoDate;
  for (const numericFormat of ["d.M.yyyy", "d/M/yyyy", "d-M-yyyy"]) {
    const numericDate = parse(value, numericFormat, referenceDate);
    if (isValid(numericDate)) return numericDate;
  }
  return null;
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
  locale: UiLocale,
) {
  const parsedDate = parseStoredDate(value);
  if (parsedDate) {
    return {
      open: false,
      inputValue: formatLocalizedDate(parsedDate, locale),
      date: parsedDate,
      month: parsedDate,
    };
  }

  if (defaultDate) {
    return {
      open: false,
      inputValue: formatLocalizedDate(defaultDate, locale),
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
  | { type: "applyParsedInput"; value: string; locale: UiLocale }
  | { type: "selectCalendarDate"; value: Date; locale: UiLocale };

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
      const parsedDate = parseLocalizedDate(newValue, action.locale);
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
        inputValue: formatLocalizedDate(action.value, action.locale),
        open: false,
      };
  }
}

export function NaturalLanguageDatePicker({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  id,
  required = false,
  defaultDate,
}: NaturalLanguageDatePickerProps) {
  const { locale } = useUiLocale();
  return (
    <NaturalLanguageDatePickerInner
      key={`${value ?? ""}:${defaultDate?.getTime() ?? ""}:${locale}`}
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
  placeholder,
  disabled,
  className,
  id,
  required = false,
  defaultDate,
}: NaturalLanguageDatePickerProps) {
  const { locale, messages } = useUiLocale();
  const [state, dispatch] = React.useReducer(
    pickerReducer,
    { value: _value, defaultDate, locale },
    ({ value, defaultDate: fallbackDate, locale: currentLocale }) =>
      getInitialPickerState(value, fallbackDate, currentLocale),
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    dispatch({ type: "applyParsedInput", value: newValue, locale });

    if (!newValue.trim()) {
      onChange?.("");
      return;
    }

    const parsedDate = parseLocalizedDate(newValue, locale);
    if (parsedDate && isValidDate(parsedDate)) {
      onChange?.(toDateString(parsedDate));
    }
  };

  const handleCalendarSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      dispatch({ type: "selectCalendarDate", value: selectedDate, locale });
      onChange?.(toDateString(selectedDate));
    }
  };

  return (
    <div className="relative">
      <Input
        id={id}
        value={state.inputValue}
        placeholder={placeholder ?? messages.datePicker.today}
        title={messages.datePicker.naturalLanguageHint}
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
            className="absolute top-1/2 right-2 size-6 -translate-y-1/2 p-0"
            type="button"
            disabled={disabled}
          >
            <CalendarIcon className="size-3.5" />
            <span className="sr-only">{messages.calendar.selectDate}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto overflow-hidden p-0"
          align="start"
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
