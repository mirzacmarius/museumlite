import {
  formatEdtf,
  type ProductionDate,
  type ProductionDatePoint,
  parseEdtf,
  productionYears,
} from "@v1/backend/convex/utils/productionDates";
import { z } from "zod";
import {
  EMPTY_PARTIAL_DATE,
  historicalDateFromDraft,
  type PartialDateDraft,
  type PartialDateQualifierChoice,
} from "@/components/provenance/historical-date";

/**
 * An Object's structured date made as the form holds it: a From and a To
 * Partial date, saved as EDTF. From alone is one date ("By" and "After"
 * leave the other side open), To alone has no start, and both are a range.
 */
export interface ProductionDateDraft {
  from: PartialDateDraft;
  to: PartialDateDraft;
  /** Entered EDTF the two dates cannot show; it stays as is until cleared. */
  fixedEdtf?: string;
}

export const EMPTY_PRODUCTION_DATE_DRAFT: ProductionDateDraft = {
  from: EMPTY_PARTIAL_DATE,
  to: EMPTY_PARTIAL_DATE,
};

/** Qualifiers a side of a range takes; By and After are for From alone. */
export const RANGE_SIDE_QUALIFIERS: readonly PartialDateQualifierChoice[] = [
  "exact",
  "circa",
];

const partialDateDraftSchema = z.object({
  precision: z.enum(["none", "day", "month", "year", "decade"]),
  year: z.string(),
  month: z.string(),
  day: z.string(),
  qualifier: z.enum(["exact", "circa", "notAfter", "notBefore"]),
  uncertain: z.boolean(),
  era: z.enum(["ad", "bc"]).optional(),
});

/** A structured date as kept on a device; used to read it back safely. */
export const productionDateDraftSchema = z.object({
  from: partialDateDraftSchema,
  to: partialDateDraftSchema,
  fixedEdtf: z.string().optional(),
});

function isOpenQualifier(qualifier: PartialDateQualifierChoice) {
  return qualifier === "notAfter" || qualifier === "notBefore";
}

/** One side as an EDTF point; a BC year turns astronomical (500 BC is -499). */
function pointFromPartial(
  draft: PartialDateDraft,
): ProductionDatePoint | undefined | null {
  const date = historicalDateFromDraft({ ...draft, era: undefined });
  if (!date) return date;
  const bc = draft.era === "bc" && date.precision === "year";
  return {
    precision: date.precision,
    year: bc ? 1 - date.year : date.year,
    month: date.month,
    day: date.day,
    approximate: date.qualifier === "circa" ? true : undefined,
    uncertain: date.uncertain,
  };
}

/** Whether From is By or After while To is also given, which EDTF can't say. */
export function hasOpenQualifierInRange(
  draft: ProductionDateDraft | undefined,
) {
  return (
    draft !== undefined &&
    draft.fixedEdtf === undefined &&
    draft.from.precision !== "none" &&
    draft.to.precision !== "none" &&
    isOpenQualifier(draft.from.qualifier)
  );
}

/**
 * The date the draft states: `undefined` when none is given, `null` when a
 * part is missing or out of range, the calendar has no such day, a range
 * ends before it starts, or From is By or After in a range. Checked with the
 * parser the server uses.
 */
export function productionDateFromDraft(
  draft: ProductionDateDraft | undefined,
): ProductionDate | undefined | null {
  if (!draft) return undefined;
  if (draft.fixedEdtf !== undefined) return parseEdtf(draft.fixedEdtf);
  const start = pointFromPartial(draft.from);
  const end = pointFromPartial(draft.to);
  if (start === null || end === null) return null;
  if (isOpenQualifier(draft.to.qualifier) && end) return null;
  let date: ProductionDate;
  if (start && end) {
    if (isOpenQualifier(draft.from.qualifier)) return null;
    date = { kind: "interval", start, end };
  } else if (start) {
    date =
      draft.from.qualifier === "notAfter"
        ? { kind: "interval", end: start }
        : draft.from.qualifier === "notBefore"
          ? { kind: "interval", start }
          : { kind: "date", date: start };
  } else if (end) {
    date = { kind: "interval", end };
  } else {
    return undefined;
  }
  return parseEdtf(formatEdtf(date));
}

/** The EDTF a save sends: `undefined` for none, `null` when incomplete. */
export function edtfFromDraft(draft: ProductionDateDraft | undefined) {
  const date = productionDateFromDraft(draft);
  return date ? formatEdtf(date) : date;
}

function partialFromPoint(
  point: ProductionDatePoint,
  qualifier: PartialDateQualifierChoice,
): PartialDateDraft | null {
  if (point.precision === "century") return null;
  const bc = point.year < 1;
  // The era is offered for a year only: EDTF's -185X is 1860 to 1851 BC, a
  // year off what staff mean by the 1850s BC.
  if (bc && point.precision !== "year") return null;
  if (point.approximate && qualifier !== "exact") return null;
  return {
    precision: point.precision,
    year: String(bc ? 1 - point.year : point.year),
    month: point.month === undefined ? "" : String(point.month),
    day: point.day === undefined ? "" : String(point.day),
    qualifier: point.approximate ? "circa" : qualifier,
    uncertain: point.uncertain === true,
    era: bc ? "bc" : undefined,
  };
}

/** A plain century as the years it spans: 18XX is 1800 to 1899. */
function centuryYears(point: ProductionDatePoint) {
  if (point.precision !== "century" || point.approximate) return undefined;
  const first = { ...point, precision: "year" as const };
  return { start: first, end: { ...first, year: point.year + 99 } };
}

/** From and To for a date, or null when they cannot show it. */
function sidesFromDate(date: ProductionDate) {
  if (date.kind === "date") {
    const century = centuryYears(date.date);
    return century
      ? {
          from: partialFromPoint(century.start, "exact"),
          to: partialFromPoint(century.end, "exact"),
        }
      : { from: partialFromPoint(date.date, "exact"), to: EMPTY_PARTIAL_DATE };
  }
  const start = date.start && (centuryYears(date.start)?.start ?? date.start);
  const end = date.end && (centuryYears(date.end)?.end ?? date.end);
  if (start && end) {
    return {
      from: partialFromPoint(start, "exact"),
      to: partialFromPoint(end, "exact"),
    };
  }
  if (start) {
    return {
      from: partialFromPoint(start, "notBefore"),
      to: EMPTY_PARTIAL_DATE,
    };
  }
  if (!end) return null;
  // A circa end with no start is To alone: From cannot be both By and circa.
  return end.approximate
    ? { from: EMPTY_PARTIAL_DATE, to: partialFromPoint(end, "exact") }
    : { from: partialFromPoint(end, "notAfter"), to: EMPTY_PARTIAL_DATE };
}

/** Whether two dates sort and filter alike: the same earliest and latest year. */
export function sameProductionYears(
  left: ProductionDate,
  right: ProductionDate,
) {
  const a = productionYears(left);
  const b = productionYears(right);
  return a.earliestYear === b.earliestYear && a.latestYear === b.latestYear;
}

/**
 * The From and To that state a date. A century becomes its first and last
 * year; a date they cannot show (a BC decade, a circa century, after circa
 * a year) is kept as fixed EDTF.
 */
export function draftFromProductionDate(
  date: ProductionDate,
): ProductionDateDraft {
  const sides = sidesFromDate(date);
  if (sides?.from && sides.to) {
    const draft = { from: sides.from, to: sides.to };
    const stated = productionDateFromDraft(draft);
    if (stated && sameProductionYears(stated, date)) return draft;
  }
  return { ...EMPTY_PRODUCTION_DATE_DRAFT, fixedEdtf: formatEdtf(date) };
}

/** The draft for a stored structured date; none gives an empty draft. */
export function draftFromEdtf(edtf: string | undefined): ProductionDateDraft {
  if (!edtf?.trim()) return EMPTY_PRODUCTION_DATE_DRAFT;
  const date = parseEdtf(edtf);
  return date
    ? draftFromProductionDate(date)
    : { ...EMPTY_PRODUCTION_DATE_DRAFT, fixedEdtf: edtf };
}

/**
 * The structured date as staff see it: "" for none, its EDTF when complete,
 * and the inputs themselves while incomplete, so partial input is a change.
 */
export function comparableProductionDate(
  draft: ProductionDateDraft | undefined,
): unknown {
  const date = productionDateFromDraft(draft);
  if (date === undefined) return "";
  return date ? formatEdtf(date) : { incomplete: draft };
}
