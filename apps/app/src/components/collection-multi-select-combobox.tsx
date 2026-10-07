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
import { Box, Check, ChevronsUpDown, Search } from "lucide-react";
import Image from "next/image";
import * as React from "react";
import { useI18n, useScopedI18n } from "@/locales/client";

interface CollectionMultiSelectComboboxProps {
  organizationId: Id<"organizations">;
  selectedIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

interface CollectionListItem {
  _id: Id<"collections">;
  title: string;
  accessionNumber: string;
  status: string;
}

interface CollectionMultiSelectState {
  open: boolean;
  searchQuery: string;
  cursor: string | null;
  allCollections: CollectionListItem[];
  isLoadingMore: boolean;
}

type CollectionMultiSelectAction =
  | { type: "setOpen"; value: boolean }
  | { type: "setSearchQuery"; value: string }
  | { type: "resetSearch" }
  | { type: "setCursor"; value: string | null }
  | { type: "setAllCollections"; value: CollectionListItem[] }
  | { type: "appendCollections"; value: CollectionListItem[] }
  | { type: "setIsLoadingMore"; value: boolean }
  | { type: "startLoadMore"; cursor: string };

const initialCollectionMultiSelectState: CollectionMultiSelectState = {
  open: false,
  searchQuery: "",
  cursor: null,
  allCollections: [],
  isLoadingMore: false,
};

function collectionMultiSelectReducer(
  state: CollectionMultiSelectState,
  action: CollectionMultiSelectAction,
): CollectionMultiSelectState {
  switch (action.type) {
    case "setOpen":
      return { ...state, open: action.value };
    case "setSearchQuery":
      return { ...state, searchQuery: action.value };
    case "resetSearch":
      return {
        ...state,
        cursor: null,
        allCollections: [],
        isLoadingMore: false,
      };
    case "setCursor":
      return { ...state, cursor: action.value };
    case "setAllCollections":
      return { ...state, allCollections: action.value };
    case "appendCollections":
      return {
        ...state,
        allCollections: [...state.allCollections, ...action.value],
      };
    case "setIsLoadingMore":
      return { ...state, isLoadingMore: action.value };
    case "startLoadMore":
      return {
        ...state,
        isLoadingMore: true,
        cursor: action.cursor,
      };
  }
}

export function CollectionMultiSelectCombobox({
  organizationId,
  selectedIds,
  onSelectionChange,
  placeholder,
  disabled = false,
}: CollectionMultiSelectComboboxProps) {
  const translate = useI18n();
  const tPicker = useScopedI18n("objectPicker");
  const [state, dispatch] = React.useReducer(
    collectionMultiSelectReducer,
    initialCollectionMultiSelectState,
  );
  const listId = React.useId();
  const listRef = React.useRef<HTMLDivElement>(null);

  // Browsing pages through recent objects; a query asks the server for
  // indexed matches instead of scanning pages until the list fills.
  const search = React.useDeferredValue(state.searchQuery.trim());
  const collectionsResult = useQuery(
    api.collections.list,
    organizationId && !search
      ? {
          organizationId,
          paginationOpts: { numItems: 50, cursor: state.cursor },
          status: "active",
        }
      : "skip",
  );
  const searchResult = useQuery(
    api.collections.searchForSelection,
    organizationId && search
      ? { organizationId, query: search, status: "active" }
      : "skip",
  );
  const visibleCollections: CollectionListItem[] = search
    ? (searchResult?.items ?? [])
    : state.allCollections;
  const isLoadingResults = search
    ? searchResult === undefined
    : collectionsResult === undefined || !collectionsResult.isDone;

  React.useEffect(() => {
    dispatch({ type: "resetSearch" });
  }, [state.searchQuery]);

  React.useEffect(() => {
    if (collectionsResult) {
      if (state.cursor === null) {
        dispatch({
          type: "setAllCollections",
          value: collectionsResult.page,
        });
      } else {
        dispatch({
          type: "appendCollections",
          value: collectionsResult.page,
        });
      }
      dispatch({ type: "setIsLoadingMore", value: false });
    }
  }, [collectionsResult, state.cursor]);

  const collectionIds = React.useMemo(
    () => visibleCollections.map((collection) => collection._id),
    [visibleCollections],
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
        collectionsResult.continueCursor !== state.cursor &&
        !state.isLoadingMore
      ) {
        dispatch({
          type: "startLoadMore",
          cursor: collectionsResult.continueCursor,
        });
      }
    },
    [collectionsResult, state.cursor, state.isLoadingMore],
  );

  React.useEffect(() => {
    // Filtering may leave a page too short to scroll. Keep filling the visible
    // list, including through empty pages, until it can scroll or is exhausted.
    const list = listRef.current;
    if (
      state.open &&
      list &&
      collectionsResult &&
      !collectionsResult.isDone &&
      !state.isLoadingMore &&
      collectionsResult.continueCursor !== state.cursor &&
      list.scrollHeight <= list.clientHeight
    ) {
      dispatch({
        type: "startLoadMore",
        cursor: collectionsResult.continueCursor,
      });
    }
  }, [
    collectionsResult,
    state.open,
    state.cursor,
    state.isLoadingMore,
    state.allCollections,
  ]);

  const handleToggle = (collectionId: string) => {
    if (selectedIds.includes(collectionId)) {
      onSelectionChange(selectedIds.filter((id) => id !== collectionId));
    } else {
      onSelectionChange([...selectedIds, collectionId]);
    }
  };

  return (
    <Popover
      open={state.open}
      onOpenChange={(value) => dispatch({ type: "setOpen", value })}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={state.open}
          aria-controls={listId}
          className="w-full justify-between"
          disabled={disabled}
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground truncate">
              {selectedIds.length > 0
                ? selectedIds.length === 1
                  ? translate("untranslatedComponents.labels.itemSelected", {
                      count: selectedIds.length,
                    })
                  : translate("untranslatedComponents.labels.itemsSelected", {
                      count: selectedIds.length,
                    })
                : (placeholder ??
                  translate(
                    "untranslatedComponents.labels.searchAndSelectCollections",
                  ))}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={translate(
              "untranslatedComponents.labels.searchByAccessionNumberOrTitle",
            )}
            value={state.searchQuery}
            onValueChange={(value) =>
              dispatch({ type: "setSearchQuery", value })
            }
          />
          <CommandList
            id={listId}
            ref={listRef}
            className="max-h-[400px] overflow-y-auto"
            onScroll={handleScroll}
          >
            <CommandEmpty>
              <div className="p-4 text-sm text-center text-muted-foreground">
                {isLoadingResults
                  ? translate("untranslatedComponents.labels.loading")
                  : translate(
                      "untranslatedComponents.labels.noCollectionsFound",
                    )}
              </div>
            </CommandEmpty>

            {visibleCollections.length > 0 && (
              <CommandGroup>
                {visibleCollections.map((collection) => {
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
                {translate("untranslatedComponents.labels.scrollForMore")}
              </div>
            )}
            {searchResult?.hasMore && (
              <div className="p-2 text-center text-xs text-muted-foreground">
                {tPicker("refineSearch")}
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

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
      className="p-2 cursor-pointer"
    >
      <div className="flex w-full items-center gap-3">
        <Check
          className={cn(
            "size-4 shrink-0",
            isSelected ? "opacity-100" : "opacity-0",
          )}
        />
        <div className="size-10 rounded bg-secondary flex items-center justify-center flex-shrink-0 overflow-hidden">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={collection.title}
              width={40}
              height={40}
              className="size-full object-cover"
            />
          ) : (
            <Box className="size-5 text-muted-foreground" />
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
