"use client";

import {
  ADVANCED_FILTER_FIELDS,
  ADVANCED_FILTER_OPERATORS,
} from "@v1/backend/convex/utils/catalogFilterValidators";
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
import type {
  FilterCondition,
  FilterGroup,
  FilterOperator,
} from "@/hooks/use-url-filters";
import { useI18n } from "@/locales/client";

interface AdvancedSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (filterGroups: FilterGroup[], groupOperator: "AND" | "OR") => void;
  initialFilterGroups?: FilterGroup[];
  initialGroupOperator?: "AND" | "OR";
}

// The object fields and tests the catalog query understands.
const FILTER_FIELDS = ADVANCED_FILTER_FIELDS.map((value) => ({ value }));
const FILTER_OPERATORS = ADVANCED_FILTER_OPERATORS.map((value) => ({ value }));

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
  const translate = useI18n();
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
      <Label className="text-sm font-medium">
        {translate("untranslatedComponents.labels.combineFilterGroupsUsing")}
      </Label>
      <Select value={groupOperator} onValueChange={onGroupOperatorChange}>
        <SelectTrigger className="w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="AND">
            {translate("untranslatedComponents.searchLogic.and")}
          </SelectItem>
          <SelectItem value="OR">
            {translate("untranslatedComponents.searchLogic.or")}
          </SelectItem>
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
  const translate = useI18n();
  return (
    <div className="flex items-end gap-2 rounded bg-muted/30 p-2">
      <div className="flex-1 space-y-1">
        <Label className="text-xs">
          {translate("untranslatedComponents.labels.field")}
        </Label>
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
                {translate(`objects.advancedSearch.fields.${field.value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 space-y-1">
        <Label className="text-xs">
          {translate("untranslatedComponents.labels.operator")}
        </Label>
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
                {translate(
                  `objects.advancedSearch.operators.${operator.value}`,
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 space-y-1">
        <Label className="text-xs">
          {translate("untranslatedComponents.labels.value")}
        </Label>
        <Input
          type="text"
          value={filter.value as string}
          onChange={(event) =>
            onUpdateFilter(groupIndex, filterIndex, {
              value: event.target.value,
            })
          }
          placeholder={translate("untranslatedComponents.labels.enterValue")}
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
  const translate = useI18n();
  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-semibold">
            {translate("untranslatedComponents.labels.filterGroup")}{" "}
            {groupIndex + 1}
          </Label>
          {group.filters.length > 1 ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">
                {translate("untranslatedComponents.labels.combineWith")}
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
                  <SelectItem value="AND">
                    {translate("untranslatedComponents.searchLogic.and")}
                  </SelectItem>
                  <SelectItem value="OR">
                    {translate("untranslatedComponents.searchLogic.or")}
                  </SelectItem>
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
        {translate("untranslatedComponents.labels.addFilter")}
      </Button>
    </div>
  );
}

const EMPTY_FILTER_GROUPS: FilterGroup[] = [];

export function AdvancedSearchDialog({
  open,
  onOpenChange,
  onApply,
  initialFilterGroups = EMPTY_FILTER_GROUPS,
  initialGroupOperator = "AND",
}: AdvancedSearchDialogProps) {
  const translate = useI18n();
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
    () => initialGroupOperator,
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
            {translate("untranslatedComponents.labels.advancedSearchFilters")}
          </DialogTitle>
          <DialogDescription>
            {translate(
              "untranslatedComponents.labels.buildComplexFilterCombinationsToSearchYourCollectionAddMultipleFilterGroupsAndCombineThemWithANDORLogic",
            )}
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
            {translate("untranslatedComponents.labels.addFilterGroup")}
          </Button>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {translate("objects.filters.advancedConditions", {
              count: totalFilters,
            })}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleClear}>
              {translate("untranslatedComponents.labels.clearAll")}
            </Button>
            <Button type="button" onClick={handleApply}>
              {translate("untranslatedComponents.labels.applyFilters")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
