"use client";

import { Button } from "@v1/ui/button";
import { X } from "lucide-react";
import type {
  SelectableObject,
  useObjectSearchSelection,
} from "@/hooks/use-object-search-selection";
import { useScopedI18n } from "@/locales/client";

interface ObjectPickerResultsProps {
  objects: SelectableObject[];
  selectedIds: ReadonlySet<string>;
  onToggle: (object: SelectableObject) => void;
  picker: ReturnType<typeof useObjectSearchSelection>;
  loadingLabel: string;
  emptyLabel: string;
}

/** Shared result list for object pickers backed by on-demand search. */
export function ObjectPickerResults({
  objects,
  selectedIds,
  onToggle,
  picker,
  loadingLabel,
  emptyLabel,
}: ObjectPickerResultsProps) {
  const t = useScopedI18n("objectPicker");
  const { isLoading, canLoadMore, isLoadingMore, loadMore, hasMoreMatches } =
    picker;

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{loadingLabel}</p>;
  }
  if (objects.length === 0 && !canLoadMore) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-2">
      <div className="max-h-[200px] space-y-1 overflow-y-auto rounded-md border border-border/60 p-2">
        {objects.map((object) => {
          const isSelected = selectedIds.has(object._id);
          return (
            <button
              key={object._id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onToggle(object)}
              className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{object.accessionNumber}</span>
                  <span className="ml-2 text-muted-foreground">
                    {object.title}
                  </span>
                </div>
                {isSelected && <X className="size-4" />}
              </div>
            </button>
          );
        })}
        {canLoadMore ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            disabled={isLoadingMore}
            onClick={loadMore}
          >
            {isLoadingMore ? t("loading") : t("loadMore")}
          </Button>
        ) : null}
      </div>
      {hasMoreMatches ? (
        <p className="text-xs text-muted-foreground">{t("refineSearch")}</p>
      ) : null}
    </div>
  );
}
