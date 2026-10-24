"use client";

import { useMemo } from "react";
import { useScopedI18n } from "@/locales/client";

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  required?: boolean;
}

export const COLUMN_IDS = [
  "checkbox",
  "image",
  "title",
  "accessionNumber",
  "location",
  "objectType",
  "dateMade",
  "status",
] as const;

export type ColumnId = (typeof COLUMN_IDS)[number];

export const DEFAULT_COLUMN_CONFIG: Record<
  ColumnId,
  { visible: boolean; required?: boolean }
> = {
  checkbox: { visible: true, required: true },
  image: { visible: true },
  title: { visible: true, required: true },
  accessionNumber: { visible: true },
  location: { visible: true },
  objectType: { visible: true },
  dateMade: { visible: true },
  status: { visible: true },
};

const COLUMN_LABEL_KEYS = {
  checkbox: "select",
  image: "image",
  title: "titleColumn",
  accessionNumber: "accessionNumber",
  location: "location",
  objectType: "objectType",
  dateMade: "dateMade",
  status: "status",
} as const;

export function useDefaultColumns(): ColumnConfig[] {
  const t = useScopedI18n("objects.columnConfig");
  return useMemo(
    () =>
      COLUMN_IDS.map((id) => ({
        id,
        label: t(COLUMN_LABEL_KEYS[id]),
        visible: DEFAULT_COLUMN_CONFIG[id].visible,
        required: DEFAULT_COLUMN_CONFIG[id].required,
      })),
    [t],
  );
}
