"use client";

import { AppliedFilterChip, AppliedFiltersBar } from "@v1/ui/filters-dropdown";
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
  className,
}: MediaAppliedFiltersProps) {
  const common = useScopedI18n("common");
  const t = useI18n();

  const showBar = filters.search !== "" || filters.fileType !== "all";
  if (!showBar) return null;

  return (
    <AppliedFiltersBar className={className}>
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
      <AppliedFilterChip label={common("clearAll")} onRemove={onClearAll} />
    </AppliedFiltersBar>
  );
}
