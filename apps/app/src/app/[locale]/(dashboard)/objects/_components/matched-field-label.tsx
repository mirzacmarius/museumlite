"use client";

import type { ObjectSearchField } from "@v1/backend/convex/utils/catalogFilterValidators";
import { useScopedI18n } from "@/locales/client";

/** Which field a search found the object in. */
export function MatchedFieldLabel({ field }: { field?: ObjectSearchField }) {
  const t = useScopedI18n("objects.search");
  if (!field) return null;
  return (
    <span className="mt-0.5 block truncate text-[10px] text-indigo-700 dark:text-indigo-300">
      {t("matchedIn", { field: t(`fields.${field}`) })}
    </span>
  );
}
