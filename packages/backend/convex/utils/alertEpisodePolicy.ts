import { type Infer, v } from "convex/values";

/**
 * The environment a Location must keep: temperature in °C, relative humidity
 * in %, light in lux and UV. Staff set temperature and humidity; light and UV
 * limits come from earlier data.
 */
export const environmentalThresholds = v.object({
  temperatureMin: v.optional(v.number()),
  temperatureMax: v.optional(v.number()),
  humidityMin: v.optional(v.number()),
  humidityMax: v.optional(v.number()),
  lightLevelMax: v.optional(v.number()),
  uvLevelMax: v.optional(v.number()),
});
export type EnvironmentalThresholds = Infer<typeof environmentalThresholds>;

/** The thresholds staff set: temperature and relative humidity limits. */
export const climateThresholds = environmentalThresholds.pick(
  "temperatureMin",
  "temperatureMax",
  "humidityMin",
  "humidityMax",
);
export type ClimateThresholds = Infer<typeof climateThresholds>;

/** Readings outside these bounds are refused at ingestion, so limits are too. */
const TEMPERATURE_BOUNDS = { min: -100, max: 100 };
const HUMIDITY_BOUNDS = { min: 0, max: 100 };

function validLimit(
  value: number | undefined,
  bounds: { min: number; max: number },
) {
  return (
    value === undefined ||
    (Number.isFinite(value) && value >= bounds.min && value <= bounds.max)
  );
}

function validRange(
  min: number | undefined,
  max: number | undefined,
  bounds: { min: number; max: number },
) {
  return (
    validLimit(min, bounds) &&
    validLimit(max, bounds) &&
    (min === undefined || max === undefined || min < max)
  );
}

/** Whether every limit is a possible reading and each minimum is below its maximum. */
export function isValidClimateThresholds(thresholds: ClimateThresholds) {
  return (
    validRange(
      thresholds.temperatureMin,
      thresholds.temperatureMax,
      TEMPERATURE_BOUNDS,
    ) &&
    validRange(thresholds.humidityMin, thresholds.humidityMax, HUMIDITY_BOUNDS)
  );
}

/** True when no limit is set, so readings cannot be judged out of range. */
export function hasNoThresholds(
  thresholds: EnvironmentalThresholds | undefined,
) {
  return (
    thresholds === undefined ||
    Object.values(thresholds).every((limit) => limit === undefined)
  );
}

export type EnvironmentalMeasure =
  | "temperature"
  | "humidity"
  | "lightLevel"
  | "uvLevel";

/** The values one reading measured; a device sends temperature and humidity. */
export type MeasuredValues = Partial<Record<EnvironmentalMeasure, number>>;

/** One measured value past one of its limits. */
export interface Breach {
  measure: EnvironmentalMeasure;
  direction: "above" | "below";
  value: number;
  limit: number;
}

const LIMITS: ReadonlyArray<{
  measure: EnvironmentalMeasure;
  direction: Breach["direction"];
  limit: keyof EnvironmentalThresholds;
}> = [
  { measure: "temperature", direction: "below", limit: "temperatureMin" },
  { measure: "temperature", direction: "above", limit: "temperatureMax" },
  { measure: "humidity", direction: "below", limit: "humidityMin" },
  { measure: "humidity", direction: "above", limit: "humidityMax" },
  { measure: "lightLevel", direction: "above", limit: "lightLevelMax" },
  { measure: "uvLevel", direction: "above", limit: "uvLevelMax" },
];

/** The limits a reading's values are past; empty when it is within them. */
export function breachesOf(
  thresholds: EnvironmentalThresholds | undefined,
  values: MeasuredValues,
): Breach[] {
  return LIMITS.flatMap(({ measure, direction, limit: limitName }) => {
    const value = values[measure];
    const limit = thresholds?.[limitName];
    if (value === undefined || limit === undefined) return [];
    const past = direction === "above" ? value > limit : value < limit;
    return past ? [{ measure, direction, value, limit }] : [];
  });
}

const MEASURE_TEXT: Record<
  EnvironmentalMeasure,
  { name: string; unit: string }
> = {
  temperature: { name: "Temperature", unit: " °C" },
  humidity: { name: "Relative humidity", unit: "%" },
  lightLevel: { name: "Light", unit: " lx" },
  uvLevel: { name: "UV", unit: "" },
};

function formatMeasurement(value: number) {
  return String(Math.round(value * 10) / 10);
}

/** English source text, for example "Relative humidity 61% above the 55% maximum". */
export function describeBreach(breach: Breach) {
  const { name, unit } = MEASURE_TEXT[breach.measure];
  const bound = breach.direction === "above" ? "maximum" : "minimum";
  return `${name} ${formatMeasurement(breach.value)}${unit} ${breach.direction} the ${formatMeasurement(breach.limit)}${unit} ${bound}`;
}

export type BreachKind = Pick<Breach, "measure" | "direction">;

/** The breached measures of an episode with a reading's added, in limit order. */
export function mergeBreaches(
  known: readonly BreachKind[],
  breaches: readonly Breach[],
): BreachKind[] {
  const seen = (kind: BreachKind) =>
    [...known, ...breaches].some(
      (other) =>
        other.measure === kind.measure && other.direction === kind.direction,
    );
  return LIMITS.filter(seen).map(({ measure, direction }) => ({
    measure,
    direction,
  }));
}

export interface ObservedRange {
  min: number;
  max: number;
}
export type ObservedRanges = Partial<
  Record<EnvironmentalMeasure, ObservedRange>
>;

/** The lowest and highest value of each measure, widened by one reading. */
export function widenRanges(
  ranges: ObservedRanges,
  values: MeasuredValues,
): ObservedRanges {
  const widened: ObservedRanges = { ...ranges };
  for (const measure of Object.keys(MEASURE_TEXT) as EnvironmentalMeasure[]) {
    const value = values[measure];
    if (value === undefined) continue;
    const range = ranges[measure];
    widened[measure] = range
      ? { min: Math.min(range.min, value), max: Math.max(range.max, value) }
      : { min: value, max: value };
  }
  return widened;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/**
 * How long after an episode starts a reading still outside the thresholds
 * escalates it: level 1 after an hour, level 2 after a day.
 */
export const ESCALATION_AFTER_MS = [HOUR_MS, 24 * HOUR_MS] as const;

/** The escalation level a breach reported `elapsedMs` after its start has reached. */
export function escalationLevelAfter(elapsedMs: number) {
  return ESCALATION_AFTER_MS.filter((after) => elapsedMs >= after).length;
}

/** English source text for a level's duration, for example "24 hours". */
export function describeEscalation(level: number) {
  const hours = (ESCALATION_AFTER_MS[level - 1] ?? 0) / HOUR_MS;
  return hours === 1 ? "1 hour" : `${hours} hours`;
}
