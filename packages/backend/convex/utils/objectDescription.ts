import { type Infer, v } from "convex/values";

/**
 * Values and limits of the Object's number of objects, subject, completeness
 * and measured parts. The form checks the same limits before a save; imports
 * use the checks below and fail one row.
 */

/** A count of the things one record describes: a pair is 2, a tea set 12. */
export const NUMBER_OF_OBJECTS_MAX = 100_000;
/** Subject terms an Object can hold, and characters per term. */
export const SUBJECTS_MAX = 50;
export const SUBJECT_TERM_MAX_LENGTH = 200;
/** Sets of measurements beyond the main one. */
export const MEASUREMENT_SETS_MAX = 20;
/** Characters of a part note or a unit in a set of measurements. */
export const MEASUREMENT_TEXT_MAX_LENGTH = 200;
/** Characters of a completeness note, as for other catalog notes. */
export const COMPLETENESS_NOTE_MAX_LENGTH = 4000;

export const COMPLETENESS_VALUES = [
  "complete",
  "incomplete",
  "fragment",
] as const;

export const completenessValidator = v.union(
  ...COMPLETENESS_VALUES.map((value) => v.literal(value)),
);

export type Completeness = Infer<typeof completenessValidator>;

/** Which part of the Object a set of measurements was taken from. */
export const MEASURED_PARTS = [
  "overall",
  "framed",
  "unframed",
  "image",
  "sight",
  "sheet",
  "plate",
  "mount",
  "base",
  "other",
] as const;

export const measuredPartValidator = v.union(
  ...MEASURED_PARTS.map((part) => v.literal(part)),
);

export type MeasuredPart = Infer<typeof measuredPartValidator>;

/**
 * A set of measurements of one part. Units are free text like the main
 * set's; `partNote` names the part more closely, such as "lid".
 */
export const measurementSetValidator = v.object({
  part: measuredPartValidator,
  partNote: v.optional(v.string()),
  height: v.optional(v.number()),
  width: v.optional(v.number()),
  depth: v.optional(v.number()),
  diameter: v.optional(v.number()),
  weight: v.optional(v.number()),
  unit: v.optional(v.string()),
  weightUnit: v.optional(v.string()),
});

export type MeasurementSet = Infer<typeof measurementSetValidator>;

const MEASUREMENT_VALUES = [
  "height",
  "width",
  "depth",
  "diameter",
  "weight",
] as const;

export function isNumberOfObjects(value: number) {
  return (
    Number.isInteger(value) && value >= 1 && value <= NUMBER_OF_OBJECTS_MAX
  );
}

/**
 * Subject terms trimmed, with blank terms and repeats in any letter case
 * left out, keeping the first spelling.
 */
export function distinctSubjectTerms(terms: readonly string[]) {
  const seen = new Set<string>();
  const subjects: string[] = [];
  for (const term of terms) {
    const text = term.trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    subjects.push(text);
  }
  return subjects;
}

/**
 * Subject terms from a source that may hold more, or longer, terms than an
 * Object keeps: the first distinct terms that fit become `subjects`, and
 * the rest are returned whole in `rest`.
 */
export function subjectsThatFit(terms: readonly string[]) {
  const subjects: string[] = [];
  const rest: string[] = [];
  for (const term of distinctSubjectTerms(terms)) {
    const fits =
      subjects.length < SUBJECTS_MAX && term.length <= SUBJECT_TERM_MAX_LENGTH;
    (fits ? subjects : rest).push(term);
  }
  return { subjects, rest };
}

/**
 * Subject terms as stored (see `distinctSubjectTerms`). Null when a term is
 * too long or too many remain.
 */
export function normalizeSubjects(terms: readonly string[]): string[] | null {
  const subjects = distinctSubjectTerms(terms);
  return subjects.length > SUBJECTS_MAX ||
    subjects.some((term) => term.length > SUBJECT_TERM_MAX_LENGTH)
    ? null
    : subjects;
}

/** A trimmed text, undefined when empty, null when too long. */
function measurementText(value: string | undefined) {
  const text = value?.trim();
  if (!text) return undefined;
  return text.length > MEASUREMENT_TEXT_MAX_LENGTH ? null : text;
}

/**
 * A set as stored: texts trimmed, empty ones left out. Null when it has no
 * value, a value that is not a finite number above 0, or a text too long.
 */
export function normalizeMeasurementSet(
  set: MeasurementSet,
): MeasurementSet | null {
  const stored: MeasurementSet = { part: set.part };
  let measured = false;
  for (const name of MEASUREMENT_VALUES) {
    const value = set[name];
    if (value === undefined) continue;
    if (!Number.isFinite(value) || value <= 0) return null;
    stored[name] = value;
    measured = true;
  }
  if (!measured) return null;
  for (const name of ["partNote", "unit", "weightUnit"] as const) {
    const text = measurementText(set[name]);
    if (text === null) return null;
    if (text !== undefined) stored[name] = text;
  }
  return stored;
}

/** Every set as stored, or null when one is refused or there are too many. */
export function normalizeMeasurementSets(
  sets: readonly MeasurementSet[],
): MeasurementSet[] | null {
  if (sets.length > MEASUREMENT_SETS_MAX) return null;
  const normalized: MeasurementSet[] = [];
  for (const set of sets) {
    const stored = normalizeMeasurementSet(set);
    if (!stored) return null;
    normalized.push(stored);
  }
  return normalized;
}

/**
 * The labels the app shows for each code (`objectDescription.completeness`
 * and `objectDescription.parts` in apps/app/src/locales), in the order en,
 * es, fr, no, ro, so an import can read a file written in any of them.
 * Keep them in step with the locales; no label may name another code.
 */
export const COMPLETENESS_LABELS: Record<Completeness, readonly string[]> = {
  complete: ["Complete", "Completo", "Complet", "Komplett", "Complet"],
  incomplete: [
    "Incomplete",
    "Incompleto",
    "Incomplet",
    "Ufullstendig",
    "Incomplet",
  ],
  fragment: ["Fragment", "Fragmento", "Fragment", "Fragment", "Fragment"],
};

export const MEASURED_PART_LABELS: Record<MeasuredPart, readonly string[]> = {
  overall: ["Overall", "Total", "Hors tout", "Totalt", "Total"],
  framed: ["Framed", "Con marco", "Encadré", "Med ramme", "Cu ramă"],
  unframed: ["Unframed", "Sin marco", "Sans cadre", "Uten ramme", "Fără ramă"],
  image: ["Image", "Imagen", "Image", "Bilde", "Imagine"],
  sight: ["Sight", "A la vista", "À vue", "Lysmål", "Dimensiune vizibilă"],
  sheet: ["Sheet", "Hoja", "Feuille", "Ark", "Foaie"],
  plate: ["Plate", "Plancha", "Cuvette", "Plate", "Placă"],
  mount: ["Mount", "Montaje", "Montage", "Montering", "Montaj"],
  base: ["Base", "Base", "Socle", "Sokkel", "Soclu"],
  other: ["Other", "Otra", "Autre", "Annet", "Altă parte"],
};

function lookupKey(text: string) {
  return text.trim().normalize("NFC").toLowerCase();
}

function codesByText<Code extends string>(
  codes: readonly Code[],
  labels: Record<Code, readonly string[]>,
) {
  const byText = new Map<string, Code>();
  for (const code of codes) {
    byText.set(code, code);
    for (const label of labels[code]) byText.set(lookupKey(label), code);
  }
  return byText;
}

const COMPLETENESS_BY_TEXT = codesByText(
  COMPLETENESS_VALUES,
  COMPLETENESS_LABELS,
);
const MEASURED_PART_BY_TEXT = codesByText(MEASURED_PARTS, MEASURED_PART_LABELS);

/**
 * A completeness or measured part from its code or its label in any of the
 * app's languages, in any letter case.
 */
export function completenessFromText(text: string | undefined) {
  return text === undefined
    ? undefined
    : COMPLETENESS_BY_TEXT.get(lookupKey(text));
}

export function measuredPartFromText(text: string | undefined) {
  return text === undefined
    ? undefined
    : MEASURED_PART_BY_TEXT.get(lookupKey(text));
}

function measurementSetFromJson(item: unknown): MeasurementSet | null {
  if (typeof item !== "object" || item === null || Array.isArray(item))
    return null;
  const fields: Record<string, unknown> = Object.fromEntries(
    Object.entries(item),
  );
  const part =
    typeof fields.part === "string"
      ? measuredPartFromText(fields.part)
      : undefined;
  if (!part) return null;
  const set: MeasurementSet = { part };
  for (const name of MEASUREMENT_VALUES) {
    const value = fields[name];
    if (value === undefined || value === null) continue;
    if (typeof value !== "number") return null;
    set[name] = value;
  }
  for (const name of ["partNote", "unit", "weightUnit"] as const) {
    const value = fields[name];
    if (value === undefined || value === null) continue;
    if (typeof value !== "string") return null;
    set[name] = value;
  }
  return set;
}

/**
 * Further sets of measurements from JSON text, as an export writes them:
 * a list of sets, each with its part code. Stored form, or null when the
 * text is not such a list or a set would be refused.
 */
export function measurementSetsFromJson(text: string): MeasurementSet[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const sets: MeasurementSet[] = [];
  for (const item of parsed) {
    const set = measurementSetFromJson(item);
    if (!set) return null;
    sets.push(set);
  }
  return normalizeMeasurementSets(sets);
}
