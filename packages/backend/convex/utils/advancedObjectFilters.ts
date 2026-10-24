import type { Doc } from "../_generated/dataModel";
import {
  ADVANCED_FILTER_FIELDS,
  type AdvancedFilterCondition,
  type AdvancedFilterField,
  type AdvancedFilterGroup,
  conditionHasValue,
} from "./catalogFilterValidators";
import { foldFacetValue, storedListValues } from "./objectSearchDocuments";
import {
  effectiveProductionDate,
  type ProductionYears,
  productionYears,
} from "./productionDates";

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

type OrderOperator = "gt" | "gte" | "lt" | "lte";

/**
 * A year compared with a date made's years, as the year range filter reads
 * them: before a year by its first, after it by its last, and an open side
 * always passes. Years are astronomical, as in EDTF.
 */
function yearMatches(
  years: ProductionYears,
  operator: OrderOperator,
  year: number,
) {
  switch (operator) {
    case "lt":
      return years.earliestYear === undefined || years.earliestYear < year;
    case "lte":
      return years.earliestYear === undefined || years.earliestYear <= year;
    case "gt":
      return years.latestYear === undefined || years.latestYear > year;
    case "gte":
      return years.latestYear === undefined || years.latestYear >= year;
  }
}

/** A typed whole year, or undefined for any other text. */
function typedYear(value: string) {
  return /^-?\d+$/.test(value) ? Number(value) : undefined;
}

/**
 * The date made compared with a year: by the years its date reads as, or as
 * text when it reads as none. Undefined leaves it to the text comparison.
 */
function dateMadeMatches(
  collection: Doc<"collections">,
  operator: OrderOperator,
  wanted: string[],
) {
  const years = wanted.map(typedYear);
  if (years.some((year) => year === undefined)) return undefined;
  const date = effectiveProductionDate(collection);
  if (!date) return undefined;
  const span = productionYears(date);
  return years.some(
    (year) => year !== undefined && yearMatches(span, operator, year),
  );
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
  if (
    condition.field === "dateCreated" &&
    (condition.operator === "gt" ||
      condition.operator === "gte" ||
      condition.operator === "lt" ||
      condition.operator === "lte")
  ) {
    const byYears = dateMadeMatches(collection, condition.operator, wanted);
    if (byYears !== undefined) return byYears;
  }
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
 * a group by the group's operator, groups by the combination. Conditions
 * left blank and groups without a condition are left out; a condition on an
 * unknown field never matches.
 */
export function matchesAdvancedFilters(
  collection: Doc<"collections">,
  groups: readonly AdvancedFilterGroup[],
  combination: "AND" | "OR" = "AND",
): boolean {
  const considered = groups.flatMap((group) => {
    const filters = group.filters.filter(conditionHasValue);
    return filters.length > 0 ? [{ ...group, filters }] : [];
  });
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
