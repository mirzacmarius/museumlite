/** Calendar schedules use compatible DST disambiguation: first fold, forward gap. */
export interface ReportSchedule {
  schedule: "daily" | "weekly" | "monthly" | "quarterly" | "on_demand";
  scheduledDay?: number;
  scheduledTime?: string;
  timezone?: string;
}

function dateFormatter(timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    calendar: "iso8601",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}

function localTimestamp(formatter: Intl.DateTimeFormat, timestamp: number) {
  const parts = formatter.formatToParts(timestamp);
  const value = (name: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === name)?.value);
  return Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
    value("second"),
  );
}

export function validateReportSchedule(config: ReportSchedule): void {
  dateFormatter(config.timezone ?? "UTC").format(0);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(config.scheduledTime ?? "09:00")) {
    throw new Error("Use a valid local time in HH:MM format");
  }
  if (config.scheduledDay !== undefined) {
    const min = config.schedule === "weekly" ? 0 : 1;
    const max = config.schedule === "weekly" ? 6 : 31;
    if (
      !Number.isInteger(config.scheduledDay) ||
      config.scheduledDay < min ||
      config.scheduledDay > max ||
      config.schedule === "daily" ||
      config.schedule === "on_demand"
    ) {
      throw new Error("Invalid day for this schedule");
    }
  }
}

function resolveLocalTime(
  formatter: Intl.DateTimeFormat,
  local: number,
): number {
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const sample = local + hours * 3_600_000;
    offsets.add(localTimestamp(formatter, sample) - sample);
  }
  const candidates = [...offsets]
    .map((offset) => local - offset)
    .sort((a, b) => a - b);
  const exact = candidates.find(
    (candidate) => localTimestamp(formatter, candidate) === local,
  );
  if (exact !== undefined) return exact;
  const forward = candidates.filter(
    (candidate) => localTimestamp(formatter, candidate) > local,
  );
  forward.sort(
    (a, b) => localTimestamp(formatter, a) - localTimestamp(formatter, b),
  );
  if (forward[0] === undefined)
    throw new Error("Local schedule time unavailable");
  return forward[0];
}

export function nextReportRun(
  config: ReportSchedule,
  after = Date.now(),
): number | undefined {
  validateReportSchedule(config);
  if (config.schedule === "on_demand") return undefined;
  const formatter = dateFormatter(config.timezone ?? "UTC");
  const localNow = new Date(localTimestamp(formatter, after));
  const [hour = 9, minute = 0] = (config.scheduledTime ?? "09:00")
    .split(":")
    .map(Number);
  const year = localNow.getUTCFullYear();
  const month = localNow.getUTCMonth();
  const day = localNow.getUTCDate();
  for (let step = 0; step < 8; step++) {
    let candidate: number;
    if (config.schedule === "daily" || config.schedule === "weekly") {
      const delta =
        config.schedule === "weekly"
          ? (((config.scheduledDay ?? 1) - localNow.getUTCDay() + 7) % 7) +
            step * 7
          : step;
      candidate = Date.UTC(year, month, day + delta, hour, minute);
    } else {
      const targetMonth =
        config.schedule === "quarterly"
          ? Math.floor(month / 3) * 3 + step * 3
          : month + step;
      const lastDay = new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate();
      candidate = Date.UTC(
        year,
        targetMonth,
        Math.min(config.scheduledDay ?? 1, lastDay),
        hour,
        minute,
      );
    }
    const utc = resolveLocalTime(formatter, candidate);
    if (utc > after) return utc;
  }
  throw new Error("Next schedule occurrence unavailable");
}
