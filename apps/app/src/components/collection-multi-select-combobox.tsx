"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@v1/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { cn } from "@v1/ui/utils";
import { useQuery } from "convex/react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import Image from "next/image";
import * as React from "react";
import { Box } from "lucide-react";

interface CollectionMultiSelectComboboxProps {
  organizationId: Id<"organizations">;
  selectedIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function CollectionMultiSelectCombobox({
  organizationId,
  selectedIds,
  onSelectionChange,
  placeholder = "Search and select collections...",
  disabled = false,
}: CollectionMultiSelectComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const listId = React.useId();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [allCollections, setAllCollections] = React.useState<
    Array<{
      _id: Id<"collections">;
      title: string;
      accessionNumber: string;
      status: "active" | "loaned" | "deaccessioned" | "archived" | "deleted";
    }>
  >([]);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Fetch collections with pagination
  const collectionsResult = useQuery(
    api.collections.list,
    organizationId
      ? {
          organizationId,
          paginationOpts: { numItems: 50, cursor },
          status: "active",
          search: searchQuery || undefined,
        }
      : "skip",
  );

  // Reset cursor and collections when search changes
  React.useEffect(() => {
    setCursor(null);
    setAllCollections([]);
    setIsLoadingMore(false);
  }, [searchQuery]);

  // Load collections when result changes
  React.useEffect(() => {
    if (collectionsResult) {
      if (cursor === null) {
        // Initial load or search change - replace all
        setAllCollections(collectionsResult.page);
      } else {
        // Append new results for pagination
        setAllCollections((prev) => [...prev, ...collectionsResult.page]);
      }
      setIsLoadingMore(false);
    }
  }, [collectionsResult, cursor]);

  const collectionIds = React.useMemo(
    () => allCollections.map((collection) => collection._id),
    [allCollections],
  );

  const batchImageUrls = useQuery(
    api.media.getBatchPrimaryImageUrls,
    collectionIds.length > 0 ? { collectionIds } : "skip",
  );

  const imageUrlMap = React.useMemo(() => {
    if (!batchImageUrls) {
      return new Map<Id<"collections">, string | null>();
    }

    return new Map(batchImageUrls.map((item) => [item.collectionId, item.url]));
  }, [batchImageUrls]);

  // Handle scroll to load more
  const handleScroll = React.useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      const isNearBottom =
        target.scrollHeight - target.scrollTop <= target.clientHeight + 100;

      if (
        isNearBottom &&
        collectionsResult &&
        !collectionsResult.isDone &&
        collectionsResult.continueCursor &&
        collectionsResult.continueCursor !== cursor &&
        !isLoadingMore
      ) {
        setIsLoadingMore(true);
        setCursor(collectionsResult.continueCursor);
      }
    },
    [collectionsResult, cursor, isLoadingMore],
  );

  const handleToggle = (collectionId: string) => {
    if (selectedIds.includes(collectionId)) {
      onSelectionChange(selectedIds.filter((id) => id !== collectionId));
    } else {
      onSelectionChange([...selectedIds, collectionId]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          className="w-full justify-between"
          disabled={disabled}
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground truncate">
              {selectedIds.length > 0
                ? `${selectedIds.length} item${selectedIds.length > 1 ? "s" : ""} selected`
                : placeholder}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by accession number or title..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList
            id={listId}
            ref={listRef}
            className="max-h-[400px] overflow-y-auto"
            onScroll={handleScroll}
          >
            <CommandEmpty>
              <div className="p-4 text-sm text-center text-muted-foreground">
                {collectionsResult === undefined
                  ? "Loading..."
                  : "No collections found."}
              </div>
            </CommandEmpty>

            {allCollections.length > 0 && (
              <CommandGroup>
                {allCollections.map((collection) => {
                  const isSelected = selectedIds.includes(collection._id);
                  return (
                    <CollectionItem
                      key={collection._id}
                      collection={collection}
                      imageUrl={imageUrlMap.get(collection._id)}
                      isSelected={isSelected}
                      onToggle={() => handleToggle(collection._id)}
                    />
                  );
                })}
              </CommandGroup>
            )}

            {collectionsResult && !collectionsResult.isDone && (
              <div className="p-2 text-center text-xs text-muted-foreground">
                Scroll for more...
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Component for individual collection item with thumbnail
function CollectionItem({
  collection,
  imageUrl,
  isSelected,
  onToggle,
}: {
  collection: {
    _id: Id<"collections">;
    title: string;
    accessionNumber: string;
  };
  imageUrl?: string | null;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <CommandItem
      value={collection._id}
      onSelect={onToggle}
      className="px-2 py-2 cursor-pointer"
    >
      <div className="flex w-full items-center gap-3">
        <Check
          className={cn(
            "h-4 w-4 shrink-0",
            isSelected ? "opacity-100" : "opacity-0",
          )}
        />
        <div className="h-10 w-10 rounded bg-secondary flex items-center justify-center flex-shrink-0 overflow-hidden">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={collection.title}
              width={40}
              height={40}
              className="h-full w-full object-cover"
            />
          ) : (
            <Box className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate text-sm">{collection.title}</div>
          <div className="text-xs text-muted-foreground font-mono">
            {collection.accessionNumber}
          </div>
        </div>
      </div>
    </CommandItem>
  );
}
