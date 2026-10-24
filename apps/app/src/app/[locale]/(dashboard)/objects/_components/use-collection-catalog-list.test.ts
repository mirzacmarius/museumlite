import { afterEach, expect, test, vi } from "vitest";
import { localDayBound } from "./use-collection-catalog-list";

afterEach(() => {
  vi.unstubAllEnvs();
});

test("a cataloguing range covers the whole local days picked, west of UTC too", () => {
  vi.stubEnv("TZ", "America/New_York");

  expect(
    new Date(localDayBound("2026-03-01", "start") ?? 0).toString(),
  ).toMatch(/^Sun Mar 01 2026 00:00:00/);
  expect(localDayBound("2026-03-01", "end")).toBe(
    Date.parse("2026-03-02T04:59:59.999Z"),
  );
});

test("an empty or partial date sets no bound", () => {
  expect(localDayBound("", "start")).toBeUndefined();
  expect(localDayBound("2026-03", "end")).toBeUndefined();
});
