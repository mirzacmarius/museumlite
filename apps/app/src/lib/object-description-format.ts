import {
  COMPLETENESS_VALUES,
  type Completeness,
  MEASURED_PARTS,
  type MeasuredPart,
  type MeasurementSet,
} from "@v1/backend/convex/utils/objectDescription";
import {
  isRightsStatementUri,
  type RightsStatementUri,
} from "@v1/backend/convex/utils/rightsStatements";

/** How measurements read in the app language. */
export interface MeasurementFormat {
  /** Abbreviations printed before the height, width and depth. */
  labels: { height: string; width: string; depth: string };
  /** Formats a measured number in the app locale. */
  number: (value: number) => string;
  /** A measured part's name in the app language. */
  part: (part: MeasuredPart) => string;
}

/** How the Object's description fields read in the app language. */
export interface ObjectDescriptionFormat {
  measurements: MeasurementFormat;
  completeness: (value: Completeness) => string;
  /** A rights statement's name in the app language. */
  rightsStatement: (uri: RightsStatementUri) => string;
}

interface Dimensions {
  height?: number;
  width?: number;
  depth?: number;
}

function withUnit(value: string, unit: string | undefined) {
  const text = unit?.trim();
  return text ? `${value} ${text}` : value;
}

/**
 * Height, width and depth as "H: 60 × W: 45.5 cm", with the unit only when
 * recorded. Undefined when none is measured.
 */
export function formatDimensions(
  { height, width, depth }: Dimensions,
  unit: string | undefined,
  { labels, number }: MeasurementFormat,
) {
  const measured = (
    [
      [labels.height, height],
      [labels.width, width],
      [labels.depth, depth],
    ] as const
  ).flatMap(([label, value]) =>
    value === undefined ? [] : [`${label}: ${number(value)}`],
  );
  return measured.length > 0 ? withUnit(measured.join(" × "), unit) : undefined;
}

/** A measured part with its note, such as "Other (lid)". */
export function formatMeasuredPart(
  part: MeasuredPart,
  partNote: string | undefined,
  format: MeasurementFormat,
) {
  const note = partNote?.trim();
  return note ? `${format.part(part)} (${note})` : format.part(part);
}

/** One set on one line: "Framed: H: 60 × W: 40 cm, Ø 12 cm, 3 kg". */
export function formatMeasurementSet(
  set: MeasurementSet,
  format: MeasurementFormat,
) {
  const values = [
    formatDimensions(set, set.unit, format),
    set.diameter === undefined
      ? undefined
      : `Ø ${withUnit(format.number(set.diameter), set.unit)}`,
    set.weight === undefined
      ? undefined
      : withUnit(format.number(set.weight), set.weightUnit),
  ].filter((value) => value !== undefined);
  return `${formatMeasuredPart(set.part, set.partNote, format)}: ${values.join(", ")}`;
}

/**
 * Each further set as its line, keyed by the line and how many sets before
 * it read alike, so lists keep their rows without stored ids.
 */
export function measurementSetLines(
  sets: readonly MeasurementSet[],
  format: MeasurementFormat,
) {
  const seen = new Map<string, number>();
  return sets.map((set) => {
    const line = formatMeasurementSet(set, format);
    const before = seen.get(line) ?? 0;
    seen.set(line, before + 1);
    return { key: `${line}#${before}`, line };
  });
}

function isCompleteness(value: unknown): value is Completeness {
  return COMPLETENESS_VALUES.some((candidate) => candidate === value);
}

export function isMeasuredPart(value: unknown): value is MeasuredPart {
  return MEASURED_PARTS.some((candidate) => candidate === value);
}

function storedNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function storedText(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

/** A stored set of measurements read from a value of unknown shape. */
function storedMeasurementSet(value: unknown): MeasurementSet | null {
  if (typeof value !== "object" || value === null) return null;
  const fields: Record<string, unknown> = Object.fromEntries(
    Object.entries(value),
  );
  if (!isMeasuredPart(fields.part)) return null;
  return {
    part: fields.part,
    partNote: storedText(fields.partNote),
    height: storedNumber(fields.height),
    width: storedNumber(fields.width),
    depth: storedNumber(fields.depth),
    diameter: storedNumber(fields.diameter),
    weight: storedNumber(fields.weight),
    unit: storedText(fields.unit),
    weightUnit: storedText(fields.weightUnit),
  };
}

/**
 * A stored value of the Object's number of objects, subject, completeness,
 * measured parts or rights statement as staff read it: names instead of
 * codes and URIs, lists joined. Null for other fields and for values that
 * state nothing, such as a cleared field.
 */
export function describeObjectDescriptionValue(
  field: string,
  value: unknown,
  format: ObjectDescriptionFormat,
): string | null {
  switch (field) {
    case "numberOfObjects": {
      const count = storedNumber(value);
      return count === undefined ? null : format.measurements.number(count);
    }
    case "subjects": {
      const terms = Array.isArray(value)
        ? value.flatMap((term) => storedText(term)?.trim() ?? [])
        : [];
      return terms.length > 0 ? terms.join(", ") : null;
    }
    case "completeness":
      return isCompleteness(value) ? format.completeness(value) : null;
    case "completenessNote":
      return storedText(value)?.trim() ?? null;
    case "dimensionMeasuredPart":
      return isMeasuredPart(value) ? format.measurements.part(value) : null;
    case "measurementSets": {
      const sets = Array.isArray(value)
        ? value.flatMap((item) => storedMeasurementSet(item) ?? [])
        : [];
      return sets.length > 0
        ? sets
            .map((set) => formatMeasurementSet(set, format.measurements))
            .join("; ")
        : null;
    }
    case "rightsStatement":
      return typeof value === "string" && isRightsStatementUri(value)
        ? format.rightsStatement(value)
        : null;
    default:
      return null;
  }
}
