"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Search, X } from "lucide-react";
import { useState, useMemo } from "react";
import type { Id } from "@v1/backend/convex/_generated/dataModel";

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
  placeholder = "Select a collection object",
  label,
  required = false,
  filterStatus = "all",
  excludeDeaccessioned = true,
}: CollectionSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const collections = useQuery(
    api.collections.list,
    organizationId
      ? {
          organizationId: organizationId as Id<"organizations">,
          paginationOpts: { numItems: 100, cursor: null },
          search: searchQuery || undefined,
          status:
            filterStatus !== "all"
              ? filterStatus
              : excludeDeaccessioned
                ? "active"
                : undefined,
        }
      : "skip",
  );

  const filteredCollections = useMemo(() => {
    if (!collections?.page) return [];
    
    // Additional client-side filtering if needed
    let filtered = collections.page;
    
    // Filter out deaccessioned if requested
    if (excludeDeaccessioned && filterStatus === "all") {
      filtered = filtered.filter((c) => c.status !== "deaccessioned");
    }
    
    // Sort by accession number for easier browsing
    return filtered.sort((a, b) =>
      a.accessionNumber.localeCompare(b.accessionNumber),
    );
  }, [collections, excludeDeaccessioned, filterStatus]);

  const selectedCollection = filteredCollections.find((c) => c._id === value);

  if (collections === undefined) {
    return (
      <div className="space-y-2">
        {label && (
          <Label>
            {label} {required && <span className="text-red-500">*</span>}
          </Label>
        )}
        <Select value={value} onValueChange={onValueChange} disabled>
          <SelectTrigger>
            <SelectValue placeholder="Loading collections..." />
          </SelectTrigger>
        </Select>
      </div>
    );
  }

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
          <SelectValue placeholder={placeholder}>
            {selectedCollection
              ? `${selectedCollection.accessionNumber} - ${selectedCollection.title}`
              : placeholder}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          {/* Search input */}
          <div className="sticky top-0 z-10 border-b border-border bg-background p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by accession number or title..."
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
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          {/* Collection list */}
          <div className="max-h-[250px] overflow-y-auto">
            {filteredCollections.length === 0 ? (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                {searchQuery
                  ? "No collections found matching your search"
                  : "No collections available"}
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
          </div>
        </SelectContent>
      </Select>
    </div>
  );
}

