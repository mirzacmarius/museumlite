"use client";

import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/locales/client";

interface RepeatableTextFieldProps {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  id?: string;
}

function createRepeatableFieldItemId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `repeatable-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function RepeatableTextField({
  label,
  value,
  onChange,
  placeholder,
  id,
}: RepeatableTextFieldProps) {
  const translate = useI18n();
  const [itemIds, setItemIds] = useState(() =>
    value.map(() => createRepeatableFieldItemId()),
  );

  useEffect(() => {
    setItemIds((previousIds) => {
      if (previousIds.length === value.length) {
        return previousIds;
      }

      if (previousIds.length > value.length) {
        return previousIds.slice(0, value.length);
      }

      return [
        ...previousIds,
        ...Array.from({ length: value.length - previousIds.length }, () =>
          createRepeatableFieldItemId(),
        ),
      ];
    });
  }, [value.length]);

  const handleAdd = () => {
    setItemIds((previousIds) => [
      ...previousIds,
      createRepeatableFieldItemId(),
    ]);
    onChange([...value, ""]);
  };

  const handleRemove = (index: number) => {
    setItemIds((previousIds) => previousIds.filter((_, i) => i !== index));
    onChange(value.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, newValue: string) => {
    const updated = [...value];
    updated[index] = newValue;
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="space-y-2">
        {value.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            {translate("untranslatedComponents.labels.noEntriesYetClickAdd")}{" "}
            {label}
            {translate("untranslatedComponents.labels.toAddOne")}
          </div>
        ) : (
          value.map((item, index) => (
            <div key={itemIds[index]} className="flex gap-2">
              <Input
                value={item}
                onChange={(e) => handleChange(index, e.target.value)}
                placeholder={placeholder}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleRemove(index)}
                title={translate("untranslatedComponents.labels.remove")}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          className="w-full"
        >
          <Plus className="mr-2 size-4" />
          {translate("untranslatedComponents.labels.add")} {label}
        </Button>
      </div>
    </div>
  );
}
