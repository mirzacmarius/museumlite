"use client";

import { Input } from "@v1/ui/input";
import { useI18n } from "@/locales/client";

interface CodeInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
}

export function CodeInput({ id = "code", value, onChange }: CodeInputProps) {
  const translate = useI18n();
  return (
    <Input
      className="h-10 border-white/10 bg-background tracking-[0.25em]"
      id={id}
      inputMode="numeric"
      maxLength={8}
      minLength={6}
      onChange={(event) => onChange(event.target.value.replace(/[^0-9]/g, ""))}
      pattern="[0-9]{6,8}"
      placeholder={translate("untranslatedComponents.labels.enterCode")}
      required
      type="text"
      value={value}
    />
  );
}
