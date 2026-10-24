import { type Infer, v } from "convex/values";

export const collectionStatusValidator = v.union(
  v.literal("active"),
  v.literal("loaned"),
  v.literal("deaccessioned"),
  v.literal("archived"),
  v.literal("deleted"),
);

/** The fields a search document holds, in the order a match is reported. */
export const OBJECT_SEARCH_FIELDS = [
  "accessionNumber",
  "title",
  "alternativeTitle",
  "creator",
  "objectName",
  "objectType",
  "description",
  "tags",
  "inscriptions",
  "materials",
  "technique",
  "culture",
  "period",
  "provenance",
  "customFields",
] as const;

export type ObjectSearchField = (typeof OBJECT_SEARCH_FIELDS)[number];

export const objectSearchFieldValidator = v.union(
  ...OBJECT_SEARCH_FIELDS.map((field) => v.literal(field)),
);

/** Object fields the advanced search dialog can test. */
export const ADVANCED_FILTER_FIELDS = [
  "title",
  "accessionNumber",
  "creator",
  "objectType",
  "objectName",
  "culture",
  "period",
  "dateCreated",
  "materials",
  "technique",
  "condition",
  "description",
] as const;

export type AdvancedFilterField = (typeof ADVANCED_FILTER_FIELDS)[number];

export const ADVANCED_FILTER_OPERATORS = [
  "eq",
  "ne",
  "contains",
  "in",
  "gt",
  "lt",
  "gte",
  "lte",
] as const;

export type AdvancedFilterOperator = (typeof ADVANCED_FILTER_OPERATORS)[number];

export const advancedFilterConditionValidator = v.object({
  field: v.string(),
  operator: v.union(
    ...ADVANCED_FILTER_OPERATORS.map((operator) => v.literal(operator)),
  ),
  value: v.union(
    v.string(),
    v.number(),
    v.boolean(),
    v.null(),
    v.array(v.string()),
    v.array(v.number()),
  ),
});

export type AdvancedFilterCondition = Infer<
  typeof advancedFilterConditionValidator
>;

export const advancedFilterGroupValidator = v.object({
  operator: v.union(v.literal("AND"), v.literal("OR")),
  filters: v.array(advancedFilterConditionValidator),
});

export type AdvancedFilterGroup = Infer<typeof advancedFilterGroupValidator>;

export const filterCombinationValidator = v.union(
  v.literal("AND"),
  v.literal("OR"),
);

/**
 * Everything that narrows the Object Catalog. The list, filtered exports and
 * bulk field edits take the same filters, so what staff see is what they act on.
 */
export const catalogFilterFields = {
  collectionGroupId: v.optional(v.id("collectionGroups")),
  includeDeaccessioned: v.optional(v.boolean()),
  inventoryMetricScope: v.optional(
    v.union(
      v.literal("owned"),
      v.literal("incoming"),
      v.literal("unclassified"),
    ),
  ),
  status: v.optional(collectionStatusValidator),
  locationIds: v.optional(v.array(v.id("locations"))),
  objectType: v.optional(v.string()),
  displayStatus: v.optional(v.string()),
  culture: v.optional(v.string()),
  period: v.optional(v.string()),
  materials: v.optional(v.string()),
  condition: v.optional(v.string()),
  /** True keeps Objects with a photograph, false those without. */
  hasImage: v.optional(v.boolean()),
  search: v.optional(v.string()),
  catalogedFrom: v.optional(v.number()),
  catalogedTo: v.optional(v.number()),
  advancedFilters: v.optional(v.array(advancedFilterGroupValidator)),
  filterCombinations: v.optional(filterCombinationValidator),
};

export const catalogFiltersValidator = v.object(catalogFilterFields);

export type CatalogFilters = Infer<typeof catalogFiltersValidator>;
