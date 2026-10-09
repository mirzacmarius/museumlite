"use client";

import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { useId } from "react";

const SUGGESTED_CURRENCIES = [
  "EUR",
  "USD",
  "GBP",
  "NOK",
  "SEK",
  "DKK",
  "CHF",
  "RON",
  "JPY",
  "CAD",
  "AUD",
];

export function isCurrencyCode(value: string) {
  return /^[A-Za-z]{3}$/.test(value.trim());
}

interface CurrencyInputProps {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}

/** Three-letter ISO 4217 currency code with common suggestions. */
export function CurrencyInput({
  id,
  label,
  hint,
  value,
  onChange,
}: CurrencyInputProps) {
  const listId = useId();
  const hintId = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        maxLength={3}
        autoComplete="off"
        list={listId}
        aria-describedby={hintId}
        className="uppercase"
        onChange={(event) => onChange(event.target.value.toUpperCase())}
      />
      <datalist id={listId}>
        {SUGGESTED_CURRENCIES.map((code) => (
          <option key={code} value={code} />
        ))}
      </datalist>
      <p id={hintId} className="text-xs text-muted-foreground">
        {hint}
      </p>
    </div>
  );
}
