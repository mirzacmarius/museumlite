import {
  MEASUREMENT_SETS_MAX,
  MEASUREMENT_TEXT_MAX_LENGTH,
  type MeasurementSet,
} from "@v1/backend/convex/utils/objectDescription";
import type { MeasurementSetEntry } from "./types";

const VALUE_FIELDS = [
  "height",
  "width",
  "depth",
  "diameter",
  "weight",
] as const;
const TEXT_FIELDS = ["partNote", "unit", "weightUnit"] as const;

/** A further set as an added row starts. */
export const EMPTY_MEASUREMENT_SET_ENTRY: MeasurementSetEntry = {
  partNote: "",
  height: "",
  width: "",
  depth: "",
  diameter: "",
  weight: "",
  unit: "",
  weightUnit: "",
};

/** A stored set as its inputs hold it. */
export function measurementSetEntry(set: MeasurementSet): MeasurementSetEntry {
  const text = (value?: number) => (value === undefined ? "" : String(value));
  return {
    part: set.part,
    partNote: set.partNote ?? "",
    height: text(set.height),
    width: text(set.width),
    depth: text(set.depth),
    diameter: text(set.diameter),
    weight: text(set.weight),
    unit: set.unit ?? "",
    weightUnit: set.weightUnit ?? "",
  };
}

/** A row staff added and left untouched. */
function isBlankEntry(entry: MeasurementSetEntry) {
  return (
    entry.part === undefined &&
    [...VALUE_FIELDS, ...TEXT_FIELDS].every((field) => !entry[field].trim())
  );
}

/** Rows staff filled in, without the ids the editor gives rows. */
export function filledMeasurementSetEntries(
  entries: readonly MeasurementSetEntry[] | undefined,
): Omit<MeasurementSetEntry, "localId">[] {
  return (entries ?? []).flatMap(({ localId: _localId, ...entry }) =>
    isBlankEntry(entry) ? [] : [entry],
  );
}

/** A typed value of a further set: blank, or a number above 0. */
function setMeasurement(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return { isValid: true as const, value: undefined };
  const value = Number(trimmed.replace(",", "."));
  return Number.isFinite(value) && value > 0
    ? { isValid: true as const, value }
    : { isValid: false as const, value: undefined };
}

type MeasurementSetProblem = "partRequired" | "invalid";

/**
 * Why one row cannot be saved, as the server would refuse it: no part, no
 * value above 0, a value that is not one, or a text too long. Null for a
 * row that can, and for a blank row, which is left out.
 */
export function measurementSetEntryProblem(
  entry: MeasurementSetEntry,
): MeasurementSetProblem | null {
  if (isBlankEntry(entry)) return null;
  if (entry.part === undefined) return "partRequired";
  const values = VALUE_FIELDS.map((field) => setMeasurement(entry[field]));
  return values.some((value) => !value.isValid) ||
    values.every((value) => value.value === undefined) ||
    TEXT_FIELDS.some(
      (field) => entry[field].trim().length > MEASUREMENT_TEXT_MAX_LENGTH,
    )
    ? "invalid"
    : null;
}

/**
 * Why the further sets cannot be saved: a row's problem, a missing part
 * first, or more filled rows than an Object holds. Null when they can.
 */
export function measurementSetsProblem(
  entries: readonly MeasurementSetEntry[] | undefined,
): MeasurementSetProblem | null {
  const problems = (entries ?? []).map(measurementSetEntryProblem);
  if (problems.includes("partRequired")) return "partRequired";
  return problems.includes("invalid") ||
    filledMeasurementSetEntries(entries).length > MEASUREMENT_SETS_MAX
    ? "invalid"
    : null;
}

/** The filled rows as the server stores them; rows without a part are left out. */
export function measurementSetsFromEntries(
  entries: readonly MeasurementSetEntry[] | undefined,
): MeasurementSet[] {
  return filledMeasurementSetEntries(entries).flatMap((entry) => {
    if (entry.part === undefined) return [];
    const set: MeasurementSet = { part: entry.part };
    for (const field of VALUE_FIELDS) {
      const { value } = setMeasurement(entry[field]);
      if (value !== undefined) set[field] = value;
    }
    for (const field of TEXT_FIELDS) {
      const text = entry[field].trim();
      if (text) set[field] = text;
    }
    return [set];
  });
}
