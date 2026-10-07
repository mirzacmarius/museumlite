"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { useQuery } from "convex/react";
import { Search, X } from "lucide-react";
import { useState } from "react";
import { useObjectSearchSelection } from "@/hooks/use-object-search-selection";
import { useI18n, useScopedI18n } from "@/locales/client";

interface CollectionSelectorProps {
  organizationId: string;
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  filterStatus?: "active" | "loaned" | "deaccessioned" | "all";
  excludeDeaccessioned?: boolean;
}

export function CollectionSelector({
  organizationId,
  value,
  onValueChange,
  placeholder,
  label,
  required = false,
  filterStatus = "all",
  excludeDeaccessioned = true,
}: CollectionSelectorProps) {
  const translate = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const tPicker = useScopedI18n("objectPicker");
  const picker = useObjectSearchSelection({
    organizationId: organizationId
      ? (organizationId as Id<"organizations">)
      : undefined,
    query: searchQuery,
    status:
      filterStatus !== "all"
        ? filterStatus
        : excludeDeaccessioned
          ? "active"
          : undefined,
    enabled: isOpen,
  });
  // The selected object may not be among the current results.
  const selectedCollection = useQuery(
    api.collections.get,
    value ? { collectionId: value as Id<"collections"> } : "skip",
  );
  const filteredCollections = picker.items.toSorted((a, b) =>
    a.accessionNumber.localeCompare(b.accessionNumber),
  );

  return (
    <div className="space-y-2">
      {label && (
        <Label>
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
      )}
      <Select
        value={value || ""}
        onValueChange={onValueChange}
        open={isOpen}
        onOpenChange={setIsOpen}
      >
        <SelectTrigger>
          <SelectValue
            placeholder={
              placeholder ??
              translate("untranslatedComponents.labels.selectACollectionObject")
            }
          >
            {selectedCollection
              ? `${selectedCollection.accessionNumber} - ${selectedCollection.title}`
              : placeholder}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          {/* Search input */}
          <div className="sticky top-0 z-10 border-b border-border bg-background p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={translate(
                  "untranslatedComponents.labels.searchByAccessionNumberOrTitle",
                )}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 pr-8"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchQuery("");
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                  <X className="size-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          {/* Collection list */}
          <div className="max-h-[250px] overflow-y-auto">
            {picker.isLoading ? (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                {translate("untranslatedComponents.labels.loadingCollections")}
              </div>
            ) : filteredCollections.length === 0 ? (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                {searchQuery
                  ? translate(
                      "untranslatedComponents.labels.noCollectionsFoundMatchingYourSearch",
                    )
                  : translate(
                      "untranslatedComponents.labels.noCollectionsAvailable",
                    )}
              </div>
            ) : (
              filteredCollections.map((collection) => (
                <SelectItem key={collection._id} value={collection._id}>
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {collection.accessionNumber}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {collection.title}
                    </span>
                  </div>
                </SelectItem>
              ))
            )}
            {picker.canLoadMore ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                disabled={picker.isLoadingMore}
                onClick={(event) => {
                  event.stopPropagation();
                  picker.loadMore();
                }}
              >
                {picker.isLoadingMore
                  ? tPicker("loading")
                  : tPicker("loadMore")}
              </Button>
            ) : null}
            {picker.hasMoreMatches ? (
              <p className="p-2 text-xs text-muted-foreground">
                {tPicker("refineSearch")}
              </p>
            ) : null}
          </div>
        </SelectContent>
      </Select>
    </div>
  );
}
