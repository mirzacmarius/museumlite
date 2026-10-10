"use client";

import { AppliedFilterChip, AppliedFiltersBar } from "@v1/ui/filters-dropdown";
import type { RefObject } from "react";
import type { MediaFileType } from "@/hooks/use-url-filters";
import { useI18n, useScopedI18n } from "@/locales/client";

export interface MediaAppliedFiltersValue {
  search: string;
  fileType: MediaFileType;
}

interface MediaAppliedFiltersProps {
  filters: MediaAppliedFiltersValue;
  onChange: (filters: Partial<MediaAppliedFiltersValue>) => void;
  onClearAll: () => void;
  /** Takes focus when the last filter is removed. */
  returnFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
}

function fileTypeLabel(fileType: MediaFileType, translate: ReturnType<typeof useI18n>) {
  switch (fileType) {
    case "image":
      return translate("mediaPage.types.image");
    case "document":
      return translate("mediaPage.types.document");
    case "3d":
      return translate("mediaPage.types.model3d");
    case "all":
      return "";
  }
}

export function MediaAppliedFilters({
  filters,
  onChange,
  onClearAll,
  returnFocusRef,
  className,
}: MediaAppliedFiltersProps) {
  const common = useScopedI18n("common");
  const t = useI18n();

  const showBar = filters.search !== "" || filters.fileType !== "all";
  if (!showBar) return null;

  return (
    <AppliedFiltersBar
      className={className}
      onClearAll={onClearAll}
      returnFocusRef={returnFocusRef}
    >
      {filters.fileType !== "all" && (
        <AppliedFilterChip
          label={t("untranslatedDashboard.media.typeFilter")}
          value={fileTypeLabel(filters.fileType, t)}
          onRemove={() => onChange({ fileType: "all" })}
        />
      )}
      {filters.search !== "" && (
        <AppliedFilterChip
          label={common("search")}
          value={filters.search}
          onRemove={() => onChange({ search: "" })}
        />
      )}
    </AppliedFiltersBar>
  );
}
