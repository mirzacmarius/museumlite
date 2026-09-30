"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Checkbox } from "@v1/ui/checkbox";
import { Input } from "@v1/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { cn } from "@v1/ui/utils";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useScopedI18n } from "@/locales/client";

export interface LocationTreeFilterOption {
  _id: Id<"locations">;
  name?: string;
  path: Array<{ _id?: Id<"locations">; name: string }>;
}

interface LocationTreeNode {
  id: string;
  name: string;
  children: LocationTreeNode[];
}

interface LocationTreeFilterProps {
  label: string;
  value: string[];
  locations: LocationTreeFilterOption[];
  onChange: (locationIds: string[]) => void;
}

function buildLocationTree(
  locations: LocationTreeFilterOption[],
): LocationTreeNode[] {
  const nodes = new Map<string, LocationTreeNode>();
  const roots: LocationTreeNode[] = [];

  const sorted = locations.toSorted((left, right) => {
    const leftPath = left.path.map((part) => part.name).join("\0");
    const rightPath = right.path.map((part) => part.name).join("\0");
    return leftPath.localeCompare(rightPath);
  });

  for (const location of sorted) {
    const pathIds = location.path.map(
      (part, index) => part._id ?? (index === location.path.length - 1
        ? location._id
        : `${location._id}:${index}`),
    );
    if (pathIds.length === 0) continue;

    let parent: LocationTreeNode | undefined;
    for (let index = 0; index < pathIds.length; index += 1) {
      const id = pathIds[index];
      if (!id) continue;
      const name = location.path[index]?.name ?? id;
      let node = nodes.get(id);
      if (!node) {
        node = { id, name, children: [] };
        nodes.set(id, node);
        if (parent) parent.children.push(node);
        else roots.push(node);
      }
      parent = node;
    }
  }

  return roots;
}

function collectMatchingIds(
  nodes: LocationTreeNode[],
  query: string,
  matched = new Set<string>(),
  ancestors: string[] = [],
): Set<string> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return matched;

  for (const node of nodes) {
    const selfMatches = node.name.toLowerCase().includes(normalized);
    const before = matched.size;
    collectMatchingIds(node.children, query, matched, [...ancestors, node.id]);
    const childMatched = matched.size > before;
    if (selfMatches || childMatched) {
      matched.add(node.id);
      for (const ancestorId of ancestors) matched.add(ancestorId);
    }
  }
  return matched;
}

function LocationTreeRows({
  nodes,
  depth,
  selectedIds,
  expandedIds,
  visibleIds,
  onToggleExpand,
  onToggleSelect,
}: {
  nodes: LocationTreeNode[];
  depth: number;
  selectedIds: Set<string>;
  expandedIds: Set<string>;
  visibleIds: Set<string> | null;
  onToggleExpand: (id: string) => void;
  onToggleSelect: (id: string) => void;
}) {
  return (
    <>
      {nodes.map((node) => {
        if (visibleIds && !visibleIds.has(node.id)) return null;
        const hasChildren = node.children.length > 0;
        const isExpanded = expandedIds.has(node.id);
        const isSelected = selectedIds.has(node.id);

        return (
          <div key={node.id}>
            <div
              className={cn(
                "flex h-8 items-center gap-1 rounded-md px-1.5 text-xs hover:bg-accent/60",
                isSelected && "bg-accent/40",
              )}
              style={{ paddingInlineStart: `${depth * 12 + 4}px` }}
            >
              {hasChildren ? (
                <button
                  type="button"
                  aria-label={isExpanded ? "Collapse" : "Expand"}
                  aria-expanded={isExpanded}
                  className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                  onClick={() => onToggleExpand(node.id)}
                >
                  {isExpanded ? (
                    <ChevronDown className="size-3.5" />
                  ) : (
                    <ChevronRight className="size-3.5" />
                  )}
                </button>
              ) : (
                <span className="size-5 shrink-0" />
              )}
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelect(node.id)}
                aria-label={`Select ${node.name}`}
                className="size-3.5"
              />
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-start"
                title={node.name}
                onClick={() => onToggleSelect(node.id)}
              >
                {node.name}
              </button>
              {isSelected ? (
                <Check className="size-3.5 shrink-0 text-indigo-400" />
              ) : null}
            </div>
            {hasChildren && isExpanded ? (
              <LocationTreeRows
                nodes={node.children}
                depth={depth + 1}
                selectedIds={selectedIds}
                expandedIds={expandedIds}
                visibleIds={visibleIds}
                onToggleExpand={onToggleExpand}
                onToggleSelect={onToggleSelect}
              />
            ) : null}
          </div>
        );
      })}
    </>
  );
}

export function LocationTreeFilter({
  label,
  value,
  locations,
  onChange,
}: LocationTreeFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const common = useScopedI18n("common");
  const t = useScopedI18n("objects");

  const tree = useMemo(() => buildLocationTree(locations), [locations]);
  const selectedIds = useMemo(() => new Set(value), [value]);
  const visibleIds = useMemo(() => {
    if (!search.trim()) return null;
    return collectMatchingIds(tree, search);
  }, [search, tree]);

  const selectedLabel = useMemo(() => {
    if (value.length === 0) return t("filters.allLocations");
    if (value.length === 1) {
      const match = locations.find((location) => location._id === value[0]);
      return (
        match?.path[match.path.length - 1]?.name ??
        match?.name ??
        t("filters.location")
      );
    }
    return `${value.length} locations`;
  }, [locations, t, value]);

  function ensureParentsExpanded(ids: Iterable<string>) {
    setExpandedIds((current) => {
      const next = new Set(current);
      for (const id of ids) next.add(id);
      return next;
    });
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSearch("");
      return;
    }
    if (value.length === 0) {
      ensureParentsExpanded(tree.map((node) => node.id));
      return;
    }
    const toExpand = new Set<string>();
    for (const location of locations) {
      if (!selectedIds.has(location._id)) continue;
      for (const part of location.path.slice(0, -1)) {
        if (part._id) toExpand.add(part._id);
      }
    }
    for (const root of tree) toExpand.add(root.id);
    ensureParentsExpanded(toExpand);
  }

  function toggleExpand(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelect(id: string) {
    if (selectedIds.has(id)) {
      onChange(value.filter((item) => item !== id));
      return;
    }
    onChange([...value, id]);
  }

  const effectiveExpandedIds = useMemo(() => {
    if (!visibleIds) return expandedIds;
    const next = new Set(expandedIds);
    for (const id of visibleIds) next.add(id);
    return next;
  }, [expandedIds, visibleIds]);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            aria-label={`${label}: ${selectedLabel}`}
            className="h-7 min-w-0 justify-between gap-2 rounded-md border-border/60 bg-muted/60 px-2.5 text-xs font-normal shadow-sm dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
          >
            <span className="truncate" title={selectedLabel}>
              {selectedLabel}
            </span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={6}
          className="w-80 max-w-[calc(100vw-2rem)] overflow-hidden p-0"
        >
          <div className="border-b border-border/60 p-2 dark:border-white/10">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={common("search")}
              aria-label={`${common("search")} ${label}`}
              className="h-8 text-xs"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            <button
              type="button"
              className={cn(
                "flex h-8 w-full items-center gap-2 rounded-md px-2 text-xs hover:bg-accent/60",
                value.length === 0 && "bg-accent/40",
              )}
              onClick={() => onChange([])}
            >
              <span className="min-w-0 flex-1 truncate text-start">
                {t("filters.allLocations")}
              </span>
              {value.length === 0 ? (
                <Check className="size-3.5 shrink-0 text-indigo-400" />
              ) : null}
            </button>
            {tree.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                {common("noResults")}
              </p>
            ) : (
              <LocationTreeRows
                nodes={tree}
                depth={0}
                selectedIds={selectedIds}
                expandedIds={effectiveExpandedIds}
                visibleIds={visibleIds}
                onToggleExpand={toggleExpand}
                onToggleSelect={toggleSelect}
              />
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
