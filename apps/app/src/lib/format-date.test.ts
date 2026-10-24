import { describe, expect, it } from "vitest";
import { formatDate, formatPartialDate } from "./format-date";

const recordedAt = new Date(Date.UTC(2026, 9, 8, 14, 30));

describe("formatDate", () => {
  it("formats a date and time when the options include a time style", () => {
    const formatted = formatDate(recordedAt, "en", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    });

    expect(formatted).toBe("Oct 8, 2026, 2:30 PM");
  });

  it("formats a date and time when the options include time fields", () => {
    const formatted = formatDate(recordedAt, "en", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    });

    expect(formatted).toBe("10/08/2026, 14:30");
  });

  it("keeps date-only output for date options", () => {
    expect(
      formatDate(recordedAt, "en", { dateStyle: "medium", timeZone: "UTC" }),
    ).toBe("Oct 8, 2026");
  });
});

describe("formatPartialDate", () => {
  it("shows a day, a month or a year in the app language", () => {
    expect(formatPartialDate("1984-05-14", "en")).toBe("May 14, 1984");
    expect(formatPartialDate("1984-05-14", "no")).toBe("14. mai 1984");
    expect(formatPartialDate("1984-05", "en")).toBe("May 1984");
    expect(formatPartialDate("1984-05", "fr")).toBe("mai 1984");
    expect(formatPartialDate("1984", "es")).toBe("1984");
  });

  it("keeps other text as written", () => {
    expect(formatPartialDate(" Spring 1984 ", "en")).toBe("Spring 1984");
    expect(formatPartialDate("1984-02-30", "en")).toBe("1984-02-30");
  });
});
