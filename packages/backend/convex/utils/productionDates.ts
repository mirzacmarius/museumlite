/**
 * Production dates in EDTF (Extended Date/Time Format, ISO 8601-2, levels 0
 * and 1): the date an Object's EDTF states, the years it spans, and how a
 * date written as text in one of the app languages reads as EDTF.
 *
 * Years are astronomical, as in EDTF: 0 is 1 BC and -499 is 500 BC.
 */

export type ProductionDatePrecision =
  | "day"
  | "month"
  | "year"
  | "decade"
  | "century";

/** One side of a production date. */
export interface ProductionDatePoint {
  precision: ProductionDatePrecision;
  /** The first year the point covers: 1850 for 185X, -499 for -04XX. */
  year: number;
  month?: number;
  day?: number;
  /** Circa ("~"). */
  approximate?: boolean;
  /** The source is unsure ("?"). */
  uncertain?: boolean;
}

/** A single date, or an interval whose missing side is open ("before 1900"). */
export type ProductionDate =
  | { kind: "date"; date: ProductionDatePoint }
  | {
      kind: "interval";
      start?: ProductionDatePoint;
      end?: ProductionDatePoint;
    };

export interface ProductionYears {
  /** Absent when the date has no start ("before 1900"). */
  earliestYear?: number;
  /** Absent when the date has no end ("after 1850"). */
  latestYear?: number;
}

/** Longest EDTF string accepted from a form. */
export const PRODUCTION_DATE_EDTF_LIMIT = 64;

const SPAN: Record<ProductionDatePrecision, number> = {
  day: 1,
  month: 1,
  year: 1,
  decade: 10,
  century: 100,
};

/** Years a circa date reaches either side, by how precise it is. */
const APPROXIMATE_MARGIN: Record<ProductionDatePrecision, number> = {
  day: 5,
  month: 5,
  year: 5,
  decade: 10,
  century: 25,
};

/** Sort keys for undated Objects, so they come last in either direction. */
export const UNDATED_SORT_EARLIEST = 1_000_000;
export const UNDATED_SORT_LATEST = -1_000_000;

function daysInMonth(year: number, month: number) {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function pointYears(point: ProductionDatePoint) {
  const margin = point.approximate ? APPROXIMATE_MARGIN[point.precision] : 0;
  return {
    first: point.year - margin,
    last: point.year + SPAN[point.precision] - 1 + margin,
  };
}

/** Whether a point names a real calendar date at its precision. */
function validPoint(point: ProductionDatePoint) {
  if (!Number.isInteger(point.year) || Math.abs(point.year) > 9999) {
    return false;
  }
  if (point.precision === "day" || point.precision === "month") {
    if (!point.month || point.month < 1 || point.month > 12) return false;
  }
  if (point.precision === "day") {
    if (
      !point.day ||
      point.day < 1 ||
      point.day > daysInMonth(point.year, point.month ?? 1)
    ) {
      return false;
    }
  }
  return true;
}

const POINT_PATTERN =
  /^(-)?(\d{4}|\d{3}X|\d{2}XX)(?:-(\d{2}))?(?:-(\d{2}))?([?~%])?$/;

function parsePoint(text: string): ProductionDatePoint | null {
  const match = POINT_PATTERN.exec(text);
  if (!match) return null;
  const [, minus, digits = "", monthText, dayText, qualifier] = match;
  const unspecified = digits.indexOf("X");
  if (unspecified !== -1 && monthText !== undefined) return null;
  if (dayText !== undefined && monthText === undefined) return null;
  const precision: ProductionDatePrecision =
    unspecified === 2
      ? "century"
      : unspecified === 3
        ? "decade"
        : dayText !== undefined
          ? "day"
          : monthText !== undefined
            ? "month"
            : "year";
  const base = Number(digits.replaceAll("X", "0"));
  const point: ProductionDatePoint = {
    precision,
    // "-185X" covers -1859 to -1850, so a negative point starts below its
    // base; "-0000" is year 0.
    year: minus ? -(base + SPAN[precision] - 1) || 0 : base,
    month: monthText === undefined ? undefined : Number(monthText),
    day: dayText === undefined ? undefined : Number(dayText),
    approximate: qualifier === "~" || qualifier === "%" ? true : undefined,
    uncertain: qualifier === "?" || qualifier === "%" ? true : undefined,
  };
  return validPoint(point) ? point : null;
}

/**
 * Reads an EDTF date: "1850", "1850-05", "1850-05-12", "185X", "18XX",
 * "-0499", qualified with "?", "~" or "%", or an interval of two of them
 * with ".." (or nothing) for an open side. Null when it is not one, or an
 * interval ends before it starts.
 */
export function parseEdtf(text: string): ProductionDate | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > PRODUCTION_DATE_EDTF_LIMIT) return null;
  const parts = trimmed.split("/");
  if (parts.length === 1) {
    const date = parsePoint(trimmed);
    return date ? { kind: "date", date } : null;
  }
  if (parts.length !== 2) return null;
  const [startText = "", endText = ""] = parts;
  const open = (part: string) => part === "" || part === "..";
  const start = open(startText) ? undefined : parsePoint(startText);
  const end = open(endText) ? undefined : parsePoint(endText);
  if (start === null || end === null) return null;
  if (!start && !end) return null;
  if (start && end && pointYears(start).first > pointYears(end).last) {
    return null;
  }
  return { kind: "interval", start, end };
}

function formatPoint(point: ProductionDatePoint) {
  const span = SPAN[point.precision];
  const negative = point.year < 0;
  const base = negative ? -point.year - (span - 1) : point.year;
  const digits =
    point.precision === "century"
      ? `${String(Math.floor(base / 100)).padStart(2, "0")}XX`
      : point.precision === "decade"
        ? `${String(Math.floor(base / 10)).padStart(3, "0")}X`
        : String(base).padStart(4, "0");
  const month =
    point.precision === "month" || point.precision === "day"
      ? `-${String(point.month ?? 1).padStart(2, "0")}`
      : "";
  const day =
    point.precision === "day"
      ? `-${String(point.day ?? 1).padStart(2, "0")}`
      : "";
  const qualifier =
    point.approximate && point.uncertain
      ? "%"
      : point.approximate
        ? "~"
        : point.uncertain
          ? "?"
          : "";
  return `${negative ? "-" : ""}${digits}${month}${day}${qualifier}`;
}

/** The EDTF string for a date, open interval sides as "..". */
export function formatEdtf(date: ProductionDate): string {
  if (date.kind === "date") return formatPoint(date.date);
  const start = date.start ? formatPoint(date.start) : "..";
  const end = date.end ? formatPoint(date.end) : "..";
  return `${start}/${end}`;
}

/** The years a date spans, circa dates widened by their margin. */
export function productionYears(date: ProductionDate): ProductionYears {
  if (date.kind === "date") {
    const { first, last } = pointYears(date.date);
    return { earliestYear: first, latestYear: last };
  }
  return {
    earliestYear: date.start ? pointYears(date.start).first : undefined,
    latestYear: date.end ? pointYears(date.end).last : undefined,
  };
}

/**
 * Sort keys: oldest-first sorts by the earliest year and newest-first by the
 * latest, an open side taking the other's year; undated Objects come last.
 */
export function productionSortKeys(years: ProductionYears | null) {
  const earliest = years?.earliestYear ?? years?.latestYear;
  const latest = years?.latestYear ?? years?.earliestYear;
  return {
    sortEarliest: earliest ?? UNDATED_SORT_EARLIEST,
    sortLatest: latest ?? UNDATED_SORT_LATEST,
  };
}

/** Whether a date's years meet an inclusive range; open sides always do. */
export function overlapsYears(
  years: ProductionYears,
  from: number | undefined,
  to: number | undefined,
) {
  if (to !== undefined && years.earliestYear !== undefined) {
    if (years.earliestYear > to) return false;
  }
  if (from !== undefined && years.latestYear !== undefined) {
    if (years.latestYear < from) return false;
  }
  return true;
}

// Dates written as text: English, Spanish, French, Norwegian and Romanian.

const CIRCA =
  /^(?:circa|cca|ca|c|approx|approximately|about|around|aprox|aproximadamente|hacia|vers|environ|env|omkring|cirka|aproximativ)(?:\.\s*|\s+)/;
const BEFORE =
  /^(?:before|by|not after|antes de|avant|før|innan|înainte de|inainte de)\s+/;
const AFTER =
  /^(?:after|not before|después de|despues de|après|apres|etter|după|dupa)\s+/;
const BETWEEN =
  /^(?:between|entre|mellom|între|intre)\s+(.+?)\s+(?:and|y|et|og|și|si)\s+(.+)$/;
const FROM_TO =
  /^(?:from|desde|de|fra|din)\s+(.+?)\s+(?:to|until|till|hasta|a|à|au|til|până la|pana la|la)\s+(.+)$/;
const RANGE =
  /^(.+?)(?:\s*-\s*|\s+(?:to|until|till|al|à|a|au|til|până la|la)\s+)(.+)$/;

// An era follows a number or a word ("500 BC", "5th century BC").
const BC_ERA =
  /(?:(?<=\d)\s*|\s+)(?:b\.?\s?c\.?\s?e\.?|b\.?\s?c\.?|f\.?\s?kr\.?|a\.?\s?c\.?|a\.?\s?de\s?c\.?|av\.?\s?j\.?-?\s?c\.?|î\.?\s?hr\.?|i\.?\s?hr\.?|î\.?\s?e\.?\s?n\.?)$/;
const AD_ERA =
  /(?:(?<=\d)\s*|\s+)(?:a\.?\s?d\.?|c\.?\s?e\.?|e\.?\s?kr\.?|d\.?\s?c\.?|apr\.?\s?j\.?-?\s?c\.?|d\.?\s?hr\.?|e\.?\s?n\.?)$/;
const AD_PREFIX = /^(?:a\.?\s?d\.?)\s*/;

const MONTHS: Record<string, number> = {};
for (const [index, names] of [
  "january jan enero janvier januar ianuarie ian",
  "february feb febrero février fevrier februar februarie",
  "march mar marzo mars mars martie",
  "april apr abril avril april aprilie",
  "may mayo mai mai mai",
  "june jun junio juin juni iunie iun",
  "july jul julio juillet juli iulie iul",
  "august aug agosto août aout august",
  "september sep sept septiembre setiembre septembre september septembrie",
  "october oct octubre octobre oktober octombrie",
  "november nov noviembre novembre november noiembrie noi",
  "december dec diciembre décembre decembre desember decembrie",
].entries()) {
  for (const name of names.split(" ")) MONTHS[name] = index + 1;
}

const ROMAN: Record<string, number> = {
  i: 1,
  v: 5,
  x: 10,
  l: 50,
};

function romanNumber(text: string) {
  if (!/^[ivxl]+$/.test(text)) return undefined;
  let total = 0;
  for (let index = 0; index < text.length; index++) {
    const value = ROMAN[text.charAt(index)] ?? 0;
    const next = ROMAN[text.charAt(index + 1)] ?? 0;
    total += value < next ? -value : value;
  }
  return total > 0 && total <= 40 ? total : undefined;
}

function centuryNumber(text: string) {
  if (/^\d{1,2}$/.test(text)) {
    const value = Number(text);
    return value >= 1 && value <= 40 ? value : undefined;
  }
  return romanNumber(text);
}

/** Strips a BC or AD marker; BC turns the year astronomical. */
function readEra(text: string) {
  const adPrefix = AD_PREFIX.exec(text);
  if (adPrefix && /^\d/.test(text.slice(adPrefix[0].length))) {
    return { rest: text.slice(adPrefix[0].length), era: "ad" as const };
  }
  const bc = BC_ERA.exec(text);
  if (bc && bc.index > 0) {
    return { rest: text.slice(0, bc.index).trim(), era: "bc" as const };
  }
  const ad = AD_ERA.exec(text);
  if (ad && ad.index > 0) {
    return { rest: text.slice(0, ad.index).trim(), era: "ad" as const };
  }
  return { rest: text, era: undefined };
}

/** A BC year as astronomical: 500 BC is -499. */
function astronomical(year: number, era: "bc" | "ad" | undefined) {
  return era === "bc" ? 1 - year : year;
}

const CENTURY_PART: Record<string, "early" | "mid" | "late"> = {
  early: "early",
  "early-": "early",
  "principios del": "early",
  "principios de": "early",
  "début du": "early",
  "debut du": "early",
  début: "early",
  tidlig: "early",
  "begynnelsen av": "early",
  începutul: "early",
  inceputul: "early",
  mid: "mid",
  "mid-": "mid",
  middle: "mid",
  "mediados del": "mid",
  "mediados de": "mid",
  "milieu du": "mid",
  "midten av": "mid",
  mijlocul: "mid",
  late: "late",
  "late-": "late",
  "finales del": "late",
  "fines del": "late",
  "fin du": "late",
  sent: "late",
  "slutten av": "late",
  sfârșitul: "late",
  sfarsitul: "late",
};

const CENTURY_PATTERNS = [
  // 19th century, 19th c., 19th-century
  /^(?:(?<part>early|early-|mid|mid-|middle|late|late-)\s*)?(?<number>\d{1,2})(?:st|nd|rd|th)[\s-]*(?:century|cent\.?|c\.?)$/,
  // siglo XIX, s. XIX, principios del siglo XIX
  /^(?:(?<part>principios del|principios de|mediados del|mediados de|finales del|fines del)\s+)?(?:siglo|s\.)\s*(?<number>[ivxl]+|\d{1,2})$/,
  // XIXe siècle, 19e siècle, fin du XIXe siècle
  /^(?:(?<part>début du|debut du|milieu du|fin du)\s+)?(?<number>[ivxl]+|\d{1,2})(?:e|ème|eme)\s+(?:siècle|siecle|s\.)$/,
  // secolul al XIX-lea, sec. XIX, sfârșitul secolului al XIX-lea
  /^(?:(?<part>începutul|inceputul|mijlocul|sfârșitul|sfarsitul)\s+)?(?:secolul|secolului|sec\.)\s*(?:al\s+)?(?<number>[ivxl]+|\d{1,2})(?:-lea)?$/,
];

/** "1800-tallet" is the 19th century in Norwegian, "1850-tallet" the 1850s. */
const NORWEGIAN_HUNDREDS =
  /^(?:(?<part>tidlig|begynnelsen av|midten av|sent|slutten av)\s+)?(?<hundreds>\d{1,2})00-tallet$/;

const DECADE_PATTERNS = [
  /^(?:the\s+)?(?<decade>\d{2,3}0)\s*'?s$/,
  /^(?:la\s+)?(?:década de|decada de|los años|años)\s+(?<decade>\d{2,3}0)$/,
  /^(?:les\s+)?années\s+(?<decade>\d{2,3}0)$/,
  /^(?<decade>\d{2,3}0)-(?:tallet|årene|arene)$/,
  /^anii\s+(?<decade>\d{2,3}0)$/,
];

function centuryPoint(
  century: number,
  era: "bc" | "ad" | undefined,
  part: "early" | "mid" | "late" | undefined,
): ProductionDate {
  // Nth century: (N-1)00 to (N-1)99; Nth century BC: N00 BC to (N-1)01 BC.
  const first = era === "bc" ? -(century * 100 - 1) : (century - 1) * 100;
  if (!part) {
    return { kind: "date", date: { precision: "century", year: first } };
  }
  const offset = { early: [0, 33], mid: [33, 66], late: [66, 99] }[part];
  return {
    kind: "interval",
    start: { precision: "year", year: first + (offset[0] ?? 0) },
    end: { precision: "year", year: first + (offset[1] ?? 99) },
  };
}

function readCentury(text: string): ProductionDate | null {
  const { rest, era } = readEra(text);
  for (const pattern of CENTURY_PATTERNS) {
    const groups = pattern.exec(rest)?.groups;
    const century = groups?.number ? centuryNumber(groups.number) : undefined;
    if (century) {
      const part = groups?.part ? CENTURY_PART[groups.part] : undefined;
      return centuryPoint(century, era, part);
    }
  }
  const hundreds = NORWEGIAN_HUNDREDS.exec(rest)?.groups;
  if (hundreds?.hundreds && era !== "bc") {
    const part = hundreds.part ? CENTURY_PART[hundreds.part] : undefined;
    return centuryPoint(Number(hundreds.hundreds) + 1, undefined, part);
  }
  return null;
}

function readDecade(text: string): ProductionDatePoint | null {
  const { rest, era } = readEra(text);
  if (era === "bc") return null;
  for (const pattern of DECADE_PATTERNS) {
    const decade = pattern.exec(rest)?.groups?.decade;
    if (decade) return { precision: "decade", year: Number(decade) };
  }
  return null;
}

/** "12 May 1850", "May 12, 1850", "May 1850", "12.05.1850", "1850/05/12". */
function readCalendarDate(text: string): ProductionDatePoint | null {
  const words = text
    .replace(/\bde\b/g, " ")
    .replace(/(\d)\.(?=\s)/g, "$1")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  let match = /^(\d{1,2}) ([a-zéèûîâșțăáíóúñ]+)\.? (\d{3,4})$/.exec(words);
  if (match) {
    const month = MONTHS[match[2] ?? ""];
    if (month) {
      return {
        precision: "day",
        year: Number(match[3]),
        month,
        day: Number(match[1]),
      };
    }
  }
  match = /^([a-zéèûîâșțăáíóúñ]+)\.? (\d{1,2}) (\d{3,4})$/.exec(words);
  if (match) {
    const month = MONTHS[match[1] ?? ""];
    if (month) {
      return {
        precision: "day",
        year: Number(match[3]),
        month,
        day: Number(match[2]),
      };
    }
  }
  match = /^([a-zéèûîâșțăáíóúñ]+)\.? (\d{3,4})$/.exec(words);
  if (match) {
    const month = MONTHS[match[1] ?? ""];
    if (month) {
      return { precision: "month", year: Number(match[2]), month };
    }
  }
  // Day first only with dots: "05/12/1850" could be either way round.
  match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text);
  if (match) {
    return {
      precision: "day",
      year: Number(match[3]),
      month: Number(match[2]),
      day: Number(match[1]),
    };
  }
  match = /^(\d{4})[./](\d{1,2})[./](\d{1,2})$/.exec(text);
  if (match) {
    return {
      precision: "day",
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
    };
  }
  return null;
}

/** One date: a year (with era), decade, century or calendar date. */
function readOne(text: string): ProductionDate | null {
  const century = readCentury(text);
  if (century) return century;
  const decade = readDecade(text);
  if (decade) return { kind: "date", date: decade };
  const calendar = readCalendarDate(text);
  if (calendar) {
    return validPoint(calendar) ? { kind: "date", date: calendar } : null;
  }
  const { rest, era } = readEra(text);
  if (/^\d{1,4}$/.test(rest)) {
    const year = Number(rest);
    if (era === "bc" && year === 0) return null;
    return {
      kind: "date",
      date: { precision: "year", year: astronomical(year, era) },
    };
  }
  return null;
}

/** The point a single date stands for, or null for an interval. */
function onePoint(text: string): ProductionDatePoint | null {
  const date = readOne(text);
  return date?.kind === "date" ? date.date : null;
}

/** "1850-60" ends in 1860; "500-400 BC" is BC on both sides. */
function readRange(left: string, right: string): ProductionDate | null {
  const rightEra = readEra(right).era;
  let start = onePoint(
    rightEra === "bc" && !readEra(left).era ? `${left} bc` : left,
  );
  let end: ProductionDatePoint | null;
  if (
    start?.precision === "year" &&
    start.year >= 1000 &&
    /^\d{1,2}$/.test(right)
  ) {
    const startDigits = String(start.year);
    end = {
      precision: "year",
      year: Number(
        startDigits.slice(0, startDigits.length - right.length) + right,
      ),
    };
  } else {
    end = onePoint(right);
  }
  if (!start || !end) return null;
  if (pointYears(start).first > pointYears(end).last) {
    // A BC range reads downwards: "500-400 BC".
    if (rightEra !== "bc") return null;
    [start, end] = [end, start];
    if (pointYears(start).first > pointYears(end).last) return null;
  }
  return { kind: "interval", start, end };
}

function qualify(
  date: ProductionDate,
  flags: { approximate: boolean; uncertain: boolean },
): ProductionDate {
  const apply = (point: ProductionDatePoint): ProductionDatePoint => ({
    ...point,
    approximate: flags.approximate || point.approximate ? true : undefined,
    uncertain: flags.uncertain || point.uncertain ? true : undefined,
  });
  if (!flags.approximate && !flags.uncertain) return date;
  if (date.kind === "date") return { kind: "date", date: apply(date.date) };
  return {
    kind: "interval",
    start: date.start ? apply(date.start) : undefined,
    end: date.end ? apply(date.end) : undefined,
  };
}

/**
 * Reads a date as staff write it: "1850", "c. 1850", "1850?", "1850s",
 * "1850-1860", "1850-60", "19th century", "late 19th century",
 * "before 1900", "after 1850", "500 BC", "12 May 1850", and the same forms
 * in Spanish, French, Norwegian and Romanian; EDTF itself is read as is.
 * Null for anything else ("Ming dynasty"), which stays display text only.
 */
export function readDateText(text: string | undefined): ProductionDate | null {
  if (!text) return null;
  const edtf = parseEdtf(text);
  if (edtf) return edtf;
  let rest = text
    .toLowerCase()
    .normalize("NFC")
    .replace(/ş/g, "ș")
    .replace(/ţ/g, "ț")
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[[(](.*)[\])]$/, "$1")
    .trim();
  if (!rest || rest.length > 80) return null;
  let uncertain = false;
  if (rest.endsWith("?")) {
    uncertain = true;
    rest = rest.slice(0, -1).trim();
  }
  let approximate = false;
  const circa = CIRCA.exec(rest);
  if (circa && rest.length > circa[0].length) {
    approximate = true;
    rest = rest.slice(circa[0].length);
  }
  const flags = { approximate, uncertain };

  const before = BEFORE.exec(rest);
  if (before) {
    const end = onePoint(rest.slice(before[0].length));
    return end ? qualify({ kind: "interval", end }, flags) : null;
  }
  const after = AFTER.exec(rest);
  if (after) {
    const start = onePoint(rest.slice(after[0].length));
    return start ? qualify({ kind: "interval", start }, flags) : null;
  }
  const one = readOne(rest);
  if (one) return qualify(one, flags);
  for (const pattern of [BETWEEN, FROM_TO, RANGE]) {
    const match = pattern.exec(rest);
    if (match?.[1] && match[2]) {
      const range = readRange(match[1].trim(), match[2].trim());
      if (range) return qualify(range, flags);
    }
  }
  return null;
}

/** The fields an Object keeps its production date in. */
export interface ProductionDateSource {
  dateCreated?: string;
  dateCreatedEdtf?: string;
}

/**
 * The date in effect for an Object: the EDTF staff entered, or else what its
 * date text reads as. Null when neither states a date.
 */
export function effectiveProductionDate(
  source: ProductionDateSource,
): ProductionDate | null {
  if (source.dateCreatedEdtf) {
    const entered = parseEdtf(source.dateCreatedEdtf);
    if (entered) return entered;
  }
  return readDateText(source.dateCreated);
}

/** The EDTF and years an Object's date stands for, for exports and filters. */
export function productionDateSummary(source: ProductionDateSource) {
  const date = effectiveProductionDate(source);
  if (!date) return null;
  return { edtf: formatEdtf(date), ...productionYears(date) };
}
