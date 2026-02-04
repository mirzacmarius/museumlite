"use client";

import type { MediaFileType } from "@/hooks/use-url-filters";
import { useScopedI18n } from "@/locales/client";
import {
  AppliedFilterChip,
  AppliedFiltersBar,
} from "@v1/ui/filters-dropdown";

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

function fileTypeLabel(fileType: MediaFileType) {
  switch (fileType) {
    case "image":
      return "Images";
    case "document":
      return "Documents";
    case "3d":
      return "3D Models";
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

  const showBar = filters.search !== "" || filters.fileType !== "all";
  if (!showBar) return null;

  return (
    <AppliedFiltersBar className={className}>
      {filters.fileType !== "all" && (
        <AppliedFilterChip
          label="Type"
          value={fileTypeLabel(filters.fileType)}
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

