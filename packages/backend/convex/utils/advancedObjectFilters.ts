import type { Doc } from "../_generated/dataModel";
import {
  ADVANCED_FILTER_FIELDS,
  type AdvancedFilterCondition,
  type AdvancedFilterField,
  type AdvancedFilterGroup,
} from "./catalogFilterValidators";
import { foldFacetValue, storedListValues } from "./objectSearchDocuments";

export {
  ADVANCED_FILTER_FIELDS,
  type AdvancedFilterCondition,
  type AdvancedFilterGroup,
};

function isAdvancedFilterField(field: string): field is AdvancedFilterField {
  return (ADVANCED_FILTER_FIELDS as readonly string[]).includes(field);
}

/** The values a field holds: one, or each entry of a stored list. */
function fieldValues(
  collection: Doc<"collections">,
  field: AdvancedFilterField,
): string[] {
  switch (field) {
    case "objectType":
      return storedListValues(collection.objectType);
    case "materials":
      return storedListValues(collection.materials);
    default: {
      const value = collection[field];
      return value ? [value] : [];
    }
  }
}

function conditionValues(value: AdvancedFilterCondition["value"]): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value === null || value === undefined) return [];
  return [String(value)];
}

/** Numbers compare as numbers (years, counts); other texts alphabetically. */
function compare(left: string, right: string) {
  const leftNumber = Number.parseFloat(left);
  const rightNumber = Number.parseFloat(right);
  if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) {
    return leftNumber - rightNumber;
  }
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

function matchesCondition(
  collection: Doc<"collections">,
  condition: AdvancedFilterCondition,
): boolean {
  if (!isAdvancedFilterField(condition.field)) return false;
  const values = fieldValues(collection, condition.field)
    .map((value) => foldFacetValue(value))
    .filter((value): value is string => value !== undefined);
  const wanted = conditionValues(condition.value)
    .map((value) => foldFacetValue(value))
    .filter((value): value is string => value !== undefined);
  const whole = foldFacetValue(values.join(", "));
  switch (condition.operator) {
    case "eq":
      return wanted.some((want) => values.includes(want) || whole === want);
    case "ne":
      return !wanted.some((want) => values.includes(want) || whole === want);
    case "contains":
      return wanted.some((want) => whole?.includes(want) ?? false);
    case "in": {
      // One typed value lists its alternatives with commas.
      const options = wanted.flatMap((want) =>
        want.split(",").flatMap((part) => {
          const folded = foldFacetValue(part);
          return folded ? [folded] : [];
        }),
      );
      return options.some(
        (option) => values.includes(option) || whole === option,
      );
    }
    case "gt":
      return wanted.some((want) =>
        values.some((value) => compare(value, want) > 0),
      );
    case "gte":
      return wanted.some((want) =>
        values.some((value) => compare(value, want) >= 0),
      );
    case "lt":
      return wanted.some((want) =>
        values.some((value) => compare(value, want) < 0),
      );
    case "lte":
      return wanted.some((want) =>
        values.some((value) => compare(value, want) <= 0),
      );
  }
}

/**
 * Whether an Object passes the advanced filters: conditions combine within
 * a group by the group's operator, groups by the combination. Empty groups
 * are left out; a condition on an unknown field never matches.
 */
export function matchesAdvancedFilters(
  collection: Doc<"collections">,
  groups: readonly AdvancedFilterGroup[],
  combination: "AND" | "OR" = "AND",
): boolean {
  const considered = groups.filter((group) => group.filters.length > 0);
  if (considered.length === 0) return true;
  const results = considered.map((group) =>
    group.operator === "OR"
      ? group.filters.some((condition) =>
          matchesCondition(collection, condition),
        )
      : group.filters.every((condition) =>
          matchesCondition(collection, condition),
        ),
  );
  return combination === "OR" ? results.some(Boolean) : results.every(Boolean);
}
