"use client";

import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { useScopedI18n } from "@/locales/client";
import { LOCATION_TYPE_KEYS } from "./constants";

interface LocationTypeSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  readOnly?: boolean;
}

export function LocationTypeSelect({
  id = "type",
  value,
  onChange,
  required = true,
  readOnly = false,
}: LocationTypeSelectProps) {
  const t = useScopedI18n("locations.form");

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{t("typeLabel")}</Label>
      <Select
        value={value.toLowerCase()}
        onValueChange={(val) =>
          onChange(val.charAt(0).toUpperCase() + val.slice(1))
        }
        required={required && !readOnly}
        disabled={readOnly}
      >
        <SelectTrigger id={id} className="disabled:opacity-100">
          <SelectValue placeholder={t("typePlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          {LOCATION_TYPE_KEYS.map((typeKey) => (
            <SelectItem key={typeKey} value={typeKey}>
              {t(`locationTypes.${typeKey}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
