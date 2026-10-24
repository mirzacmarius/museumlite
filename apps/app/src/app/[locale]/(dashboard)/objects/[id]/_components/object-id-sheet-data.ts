import type { MeasuredPart } from "@v1/backend/convex/utils/objectDescription";
import {
  OBJECT_ID_CATEGORIES,
  type ObjectIdCategory,
} from "@v1/backend/convex/utils/objectId";
import type { ProductionDateSource } from "@v1/backend/convex/utils/productionDates";
import {
  formatDimensions,
  formatMeasurementSet,
  type MeasurementFormat,
} from "@/lib/object-description-format";
import { parseStringListField } from "@/lib/string-list-field";
import type { CollectionData } from "./types";

/** Characters of the description a one-page sheet has room for. */
export const SHORT_DESCRIPTION_LIMIT = 700;
/** Lines a category prints before the rest is counted, so the sheet stays one page. */
export const CATEGORY_LINE_LIMIT = 6;
/** Characters a single line prints before it is clipped. */
export const LINE_LENGTH_LIMIT = 240;

export interface ObjectIdCategoryValue {
  category: ObjectIdCategory;
  /** What the record says, one statement per line; none means not recorded. */
  lines: string[];
  /** Statements left off the sheet for room. */
  omitted: number;
}

export type ObjectIdSheetCollection = Pick<
  CollectionData,
  | "title"
  | "alternativeTitle"
  | "objectType"
  | "objectName"
  | "creator"
  | "dateCreated"
  | "dateCreatedEdtf"
  | "period"
  | "materials"
  | "technique"
  | "dimensions"
  | "dimensionDiameter"
  | "dimensionHeight"
  | "dimensionWidth"
  | "dimensionDepth"
  | "dimensionWeight"
  | "dimensionUnit"
  | "weightUnit"
  | "dimensionMeasuredPart"
  | "measurementSets"
  | "inscriptions"
  | "inscriptionMarks"
  | "subjects"
>;

/** How measurements and dates read in the app language. */
export interface ObjectIdSheetFormat {
  /** Abbreviations printed before the height, width and depth. */
  measurementLabels: { height: string; width: string; depth: string };
  /** Formats a measured number in the app locale. */
  number: (value: number) => string;
  /** A measured part's name in the app language. */
  part: (part: MeasuredPart) => string;
  /** The date made as written, else its structured date in the locale. */
  dateMade: (source: ProductionDateSource) => string | undefined;
}

export interface ObjectIdSheetSource {
  collection: ObjectIdSheetCollection;
  /**
   * Physical characteristics that help identify the object, as the accepted
   * condition assessment records them (its summary and observations).
   */
  distinguishingFeatures: readonly string[];
  format: ObjectIdSheetFormat;
}

function present(values: ReadonlyArray<string | undefined | null>) {
  return values.flatMap((value) => {
    const text = value?.trim();
    return text ? [text] : [];
  });
}

/** Object types and materials are stored as text or as a JSON list. */
function listed(value: string | undefined) {
  const items = parseStringListField(value);
  return items.length > 0 ? items.join(", ") : undefined;
}

function clipText(text: string, limit: number) {
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;
}

/**
 * The main measurements, the first line naming the part they were taken
 * from when stated, then one line for each further part.
 */
function measurementLines(
  collection: ObjectIdSheetCollection,
  { measurementLabels, number, part }: ObjectIdSheetFormat,
) {
  const format: MeasurementFormat = { labels: measurementLabels, number, part };
  // The unit is printed only when recorded, as on the Physical tab.
  const measured = formatDimensions(
    {
      height: collection.dimensionHeight,
      width: collection.dimensionWidth,
      depth: collection.dimensionDepth,
    },
    collection.dimensionUnit,
    format,
  );
  const [first, ...rest] = present([
    measured,
    collection.dimensionDiameter
      ? `Ø ${collection.dimensionDiameter}`
      : undefined,
    collection.dimensionWeight !== undefined
      ? `${number(collection.dimensionWeight)} ${collection.weightUnit || "kg"}`
      : undefined,
  ]);
  const measuredPart = collection.dimensionMeasuredPart;
  const main = first
    ? [measuredPart ? `${part(measuredPart)}: ${first}` : first, ...rest]
    : [];
  return [
    ...main,
    // Free-text dimensions come from imports and older records.
    ...present([measured ? undefined : collection.dimensions]),
    ...(collection.measurementSets ?? []).map((set) =>
      formatMeasurementSet(set, format),
    ),
  ];
}

function inscriptionLines(collection: ObjectIdSheetCollection) {
  return present([
    collection.inscriptions,
    ...(collection.inscriptionMarks ?? []).map((mark) =>
      mark.description.trim()
        ? `${mark.label.trim() || "—"}: ${mark.description.trim()}`
        : "",
    ),
  ]);
}

function categoryLines(
  category: ObjectIdCategory,
  { collection, distinguishingFeatures, format }: ObjectIdSheetSource,
): string[] {
  switch (category) {
    case "type_of_object":
      return present([listed(collection.objectType), collection.objectName]);
    case "materials_and_techniques":
      return present([listed(collection.materials), collection.technique]);
    case "measurements":
      return measurementLines(collection, format);
    case "inscriptions_and_markings":
      return inscriptionLines(collection);
    case "distinguishing_features":
      return present(distinguishingFeatures);
    case "title":
      return present([collection.title, collection.alternativeTitle]);
    case "subject":
      return present([
        collection.subjects?.length
          ? collection.subjects.join(", ")
          : undefined,
      ]);
    case "date_or_period":
      return present([format.dateMade(collection), collection.period]);
    case "maker":
      return present([collection.creator]);
  }
}

/** Keeps the first lines, clipped, and counts the rest. */
function fitLines(
  lines: string[],
): Pick<ObjectIdCategoryValue, "lines" | "omitted"> {
  const kept = lines
    .slice(0, CATEGORY_LINE_LIMIT)
    .map((line) => clipText(line, LINE_LENGTH_LIMIT));
  return { lines: kept, omitted: lines.length - kept.length };
}

/** The nine Object ID categories with what the record says for each. */
export function objectIdCategoryValues(
  source: ObjectIdSheetSource,
): ObjectIdCategoryValue[] {
  return OBJECT_ID_CATEGORIES.map((category) => ({
    category,
    ...fitLines(categoryLines(category, source)),
  }));
}

/** The description clipped to what fits on one page. */
export function shortDescription(description: string | undefined) {
  const text = description?.trim();
  if (!text) return undefined;
  return clipText(text, SHORT_DESCRIPTION_LIMIT);
}
