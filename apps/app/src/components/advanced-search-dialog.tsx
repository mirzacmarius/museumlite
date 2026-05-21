"use client";

import type {
  FilterCondition,
  FilterGroup,
  FilterOperator,
} from "@/hooks/use-url-filters";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Filter, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";

interface AdvancedSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (filterGroups: FilterGroup[], groupOperator: "AND" | "OR") => void;
  initialFilterGroups?: FilterGroup[];
  initialGroupOperator?: "AND" | "OR";
}

// Available fields for filtering
const FILTER_FIELDS = [
  { value: "title", label: "Title" },
  { value: "accessionNumber", label: "Accession Number" },
  { value: "creator", label: "Creator" },
  { value: "objectType", label: "Object Type" },
  { value: "objectName", label: "Object Name" },
  { value: "culture", label: "Culture" },
  { value: "period", label: "Period" },
  { value: "dateCreated", label: "Date Created" },
  { value: "materials", label: "Materials" },
  { value: "technique", label: "Technique" },
  { value: "condition", label: "Condition" },
  { value: "description", label: "Description" },
];

// Filter operators with labels
const FILTER_OPERATORS = [
  { value: "eq", label: "Equals" },
  { value: "ne", label: "Not Equals" },
  { value: "contains", label: "Contains" },
  { value: "in", label: "In List" },
  { value: "gt", label: "Greater Than" },
  { value: "lt", label: "Less Than" },
  { value: "gte", label: "Greater Than or Equal" },
  { value: "lte", label: "Less Than or Equal" },
];

type FilterConditionWithId = FilterCondition & { id: string };
type FilterGroupWithId = Omit<FilterGroup, "filters"> & {
  id: string;
  filters: FilterConditionWithId[];
};

function GroupOperatorSelector({
  groupOperator,
  onGroupOperatorChange,
}: {
  groupOperator: "AND" | "OR";
  onGroupOperatorChange: (operator: "AND" | "OR") => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
      <Label className="text-sm font-medium">
        Combine filter groups using:
      </Label>
      <Select value={groupOperator} onValueChange={onGroupOperatorChange}>
        <SelectTrigger className="w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="AND">AND</SelectItem>
          <SelectItem value="OR">OR</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function FilterConditionRow({
  filter,
  groupIndex,
  filterIndex,
  onRemoveFilter,
  onUpdateFilter,
}: {
  filter: FilterConditionWithId;
  groupIndex: number;
  filterIndex: number;
  onRemoveFilter: (groupIndex: number, filterIndex: number) => void;
  onUpdateFilter: (
    groupIndex: number,
    filterIndex: number,
    updates: Partial<FilterCondition>,
  ) => void;
}) {
  return (
    <div className="flex items-end gap-2 rounded bg-muted/30 p-2">
      <div className="flex-1 space-y-1">
        <Label className="text-xs">Field</Label>
        <Select
          value={filter.field}
          onValueChange={(value) =>
            onUpdateFilter(groupIndex, filterIndex, { field: value })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTER_FIELDS.map((field) => (
              <SelectItem key={field.value} value={field.value}>
                {field.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 space-y-1">
        <Label className="text-xs">Operator</Label>
        <Select
          value={filter.operator}
          onValueChange={(value) =>
            onUpdateFilter(groupIndex, filterIndex, {
              operator: value as FilterOperator,
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTER_OPERATORS.map((operator) => (
              <SelectItem key={operator.value} value={operator.value}>
                {operator.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 space-y-1">
        <Label className="text-xs">Value</Label>
        <Input
          type="text"
          value={filter.value as string}
          onChange={(event) =>
            onUpdateFilter(groupIndex, filterIndex, {
              value: event.target.value,
            })
          }
          placeholder="Enter value..."
        />
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onRemoveFilter(groupIndex, filterIndex)}
        className="flex-shrink-0"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

function FilterGroupEditor({
  canRemove,
  group,
  groupIndex,
  onAddFilter,
  onRemoveFilter,
  onRemoveFilterGroup,
  onUpdateFilter,
  onUpdateGroupOperator,
}: {
  canRemove: boolean;
  group: FilterGroupWithId;
  groupIndex: number;
  onAddFilter: (groupIndex: number) => void;
  onRemoveFilter: (groupIndex: number, filterIndex: number) => void;
  onRemoveFilterGroup: (groupIndex: number) => void;
  onUpdateFilter: (
    groupIndex: number,
    filterIndex: number,
    updates: Partial<FilterCondition>,
  ) => void;
  onUpdateGroupOperator: (groupIndex: number, operator: "AND" | "OR") => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-semibold">
            Filter Group {groupIndex + 1}
          </Label>
          {group.filters.length > 1 ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">
                Combine with:
              </span>
              <Select
                value={group.operator}
                onValueChange={(value) =>
                  onUpdateGroupOperator(groupIndex, value as "AND" | "OR")
                }
              >
                <SelectTrigger className="h-7 w-20 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AND">AND</SelectItem>
                  <SelectItem value="OR">OR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
        {canRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRemoveFilterGroup(groupIndex)}
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>

      <div className="space-y-2">
        {group.filters.map((filter, filterIndex) => (
          <FilterConditionRow
            key={filter.id}
            filter={filter}
            filterIndex={filterIndex}
            groupIndex={groupIndex}
            onRemoveFilter={onRemoveFilter}
            onUpdateFilter={onUpdateFilter}
          />
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onAddFilter(groupIndex)}
        className="w-full"
      >
        <Plus className="mr-2 size-4" />
        Add Filter
      </Button>
    </div>
  );
}

export function AdvancedSearchDialog({
  open,
  onOpenChange,
  onApply,
  initialFilterGroups = [],
  initialGroupOperator = "AND",
}: AdvancedSearchDialogProps) {
  const createId = () => {
    const uuid = globalThis.crypto?.randomUUID?.();
    if (uuid) return uuid;
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const toStateGroups = (groups: FilterGroup[]): FilterGroupWithId[] => {
    if (groups.length === 0) {
      return [{ id: createId(), filters: [], operator: "AND" }];
    }
    return groups.map((g) => ({
      id: createId(),
      operator: g.operator,
      filters: g.filters.map((f) => ({ ...f, id: createId() })),
    }));
  };

  const [filterGroups, setFilterGroups] = useState<FilterGroupWithId[]>(() =>
    toStateGroups(initialFilterGroups),
  );
  const [groupOperator, setGroupOperator] = useState<"AND" | "OR">(
    initialGroupOperator,
  );

  const addFilterGroup = () => {
    setFilterGroups((prev) => [
      ...prev,
      { id: createId(), filters: [], operator: "AND" },
    ]);
  };

  const removeFilterGroup = (groupIndex: number) => {
    setFilterGroups((previousGroups) =>
      previousGroups.length > 1
        ? previousGroups.filter((_, i) => i !== groupIndex)
        : previousGroups,
    );
  };

  const addFilter = (groupIndex: number) => {
    setFilterGroups((previousGroups) =>
      previousGroups.map((group, index) => {
        if (index !== groupIndex) return group;
        return {
          ...group,
          filters: [
            ...group.filters,
            {
              id: createId(),
              field: "title",
              operator: "contains",
              value: "",
            },
          ],
        };
      }),
    );
  };

  const removeFilter = (groupIndex: number, filterIndex: number) => {
    setFilterGroups((previousGroups) =>
      previousGroups.map((group, index) => {
        if (index !== groupIndex) return group;
        return {
          ...group,
          filters: group.filters.filter((_, i) => i !== filterIndex),
        };
      }),
    );
  };

  const updateFilter = (
    groupIndex: number,
    filterIndex: number,
    updates: Partial<FilterCondition>,
  ) => {
    setFilterGroups((previousGroups) =>
      previousGroups.map((group, index) => {
        if (index !== groupIndex) return group;
        const existingFilter = group.filters[filterIndex];
        if (!existingFilter) return group;
        return {
          ...group,
          filters: group.filters.map((filter, i) =>
            i === filterIndex ? { ...existingFilter, ...updates } : filter,
          ),
        };
      }),
    );
  };

  const updateGroupOperator = (groupIndex: number, operator: "AND" | "OR") => {
    setFilterGroups((previousGroups) =>
      previousGroups.map((group, index) =>
        index === groupIndex ? { ...group, operator } : group,
      ),
    );
  };

  const handleApply = () => {
    // Filter out empty filter groups
    const validFilterGroups = filterGroups.flatMap((group) => {
      const filters = group.filters.filter(
        (filter) => filter.value !== "" && filter.value !== null,
      );
      return filters.length > 0 ? [{ operator: group.operator, filters }] : [];
    });

    onApply(
      validFilterGroups.map((g) => ({
        operator: g.operator,
        filters: g.filters.map(({ id: _id, ...filter }) => filter),
      })),
      groupOperator,
    );
    onOpenChange(false);
  };

  const handleClear = () => {
    setFilterGroups([{ id: createId(), filters: [], operator: "AND" }]);
    setGroupOperator("AND");
  };

  const totalFilters = filterGroups.reduce(
    (sum, group) => sum + group.filters.length,
    0,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="size-5" />
            Advanced Search Filters
          </DialogTitle>
          <DialogDescription>
            Build complex filter combinations to search your collection. Add
            multiple filter groups and combine them with AND/OR logic.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {filterGroups.length > 1 && (
            <GroupOperatorSelector
              groupOperator={groupOperator}
              onGroupOperatorChange={setGroupOperator}
            />
          )}

          <div className="space-y-4">
            {filterGroups.map((group, groupIndex) => (
              <FilterGroupEditor
                key={group.id}
                canRemove={filterGroups.length > 1}
                group={group}
                groupIndex={groupIndex}
                onAddFilter={addFilter}
                onRemoveFilter={removeFilter}
                onRemoveFilterGroup={removeFilterGroup}
                onUpdateFilter={updateFilter}
                onUpdateGroupOperator={updateGroupOperator}
              />
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={addFilterGroup}
            className="w-full"
          >
            <Plus className="mr-2 size-4" />
            Add Filter Group
          </Button>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {totalFilters} {totalFilters === 1 ? "filter" : "filters"} defined
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleClear}>
              Clear All
            </Button>
            <Button type="button" onClick={handleApply}>
              Apply Filters
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
