import { format } from "date-fns";
import { describe, expect, it } from "vitest";
import type { UiLocale } from "../locale";
import {
  formatLocalizedDate,
  parseLocalizedDate,
} from "./natural-language-date-picker";

const referenceDate = new Date("2026-05-10T12:00:00.000Z");

describe("parseLocalizedDate", () => {
  function formatted(value: string, locale: UiLocale) {
    const parsed = parseLocalizedDate(value, locale, referenceDate);
    return parsed ? format(parsed, "yyyy-MM-dd") : null;
  }

  it("parses ISO and numeric dates for Norwegian and Romanian", () => {
    expect(formatted("2026-06-14", "no")).toBe("2026-06-14");
    expect(formatted("14.06.2026", "ro")).toBe("2026-06-14");
  });

  it("parses today, tomorrow, and yesterday in Norwegian and Romanian", () => {
    expect(formatted("i morgen", "no")).toBe("2026-05-11");
    expect(formatted("ieri", "ro")).toBe("2026-05-09");
    expect(formatted("azi", "ro")).toBe("2026-05-10");
  });

  it("parses natural dates in French and Spanish and recalculates by locale", () => {
    expect(formatted("demain", "fr")).toBe("2026-05-11");
    expect(formatted("mañana", "es")).toBe("2026-05-11");
    expect(formatted("mañana", "fr")).toBeNull();
    expect(formatted("2026-06-14", "fr")).toBe("2026-06-14");
  });

  it("returns null for unsupported or invalid input", () => {
    expect(formatted("not a date", "en")).toBeNull();
    expect(formatted("99.99.2026", "ro")).toBeNull();
    expect(formatted("next Friday", "en")).toBeNull();
  });

  it("formats selected dates using the active locale", () => {
    const date = new Date("2026-06-14T12:00:00.000Z");
    expect(formatLocalizedDate(date, "en")).toBe("June 14th, 2026");
    expect(formatLocalizedDate(date, "fr")).toBe("14 juin 2026");
    expect(formatLocalizedDate(date, "es")).toBe("14 de junio de 2026");
  });
});
