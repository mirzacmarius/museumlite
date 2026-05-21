import { describe, expect, it } from "vitest";
import {
  getExhibitionScheduleStatus,
  matchesScheduleFilter,
} from "./exhibition-schedule-status";

const now = 1_000_000;

describe("getExhibitionScheduleStatus", () => {
  it("returns undefined when now is undefined", () => {
    expect(
      getExhibitionScheduleStatus(
        { startDate: now - 10, endDate: now + 10 },
        undefined,
      ),
    ).toBeUndefined();
  });

  it("returns past when end date is before now", () => {
    expect(
      getExhibitionScheduleStatus(
        { startDate: now - 100, endDate: now - 1 },
        now,
      ),
    ).toBe("past");
  });

  it("returns upcoming when start date is after now", () => {
    expect(getExhibitionScheduleStatus({ startDate: now + 1 }, now)).toBe(
      "upcoming",
    );
  });

  it("returns current when started and not ended", () => {
    expect(
      getExhibitionScheduleStatus(
        { startDate: now - 10, endDate: now + 10 },
        now,
      ),
    ).toBe("current");
  });

  it("returns current when started with no end date", () => {
    expect(getExhibitionScheduleStatus({ startDate: now - 10 }, now)).toBe(
      "current",
    );
  });
});

describe("matchesScheduleFilter", () => {
  it("matches all regardless of status", () => {
    expect(matchesScheduleFilter(undefined, "all")).toBe(true);
    expect(matchesScheduleFilter("past", "all")).toBe(true);
  });

  it("matches specific schedule filters", () => {
    expect(matchesScheduleFilter("past", "past")).toBe(true);
    expect(matchesScheduleFilter("current", "past")).toBe(false);
    expect(matchesScheduleFilter(undefined, "current")).toBe(false);
  });
});
