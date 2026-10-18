import { describe, expect, test } from "vitest";
import { notificationEntityHref } from "./notificationLinks";

describe("notificationEntityHref", () => {
  test("opens object notifications at the canonical object route", () => {
    expect(notificationEntityHref("collection", "obj123")).toBe(
      "/objects/obj123",
    );
    expect(notificationEntityHref("object", "obj123")).toBe("/objects/obj123");
  });

  test("opens move requests and installation tasks at their own routes", () => {
    expect(notificationEntityHref("move_request", "m1")).toBe(
      "/objects/move-requests/m1",
    );
    expect(notificationEntityHref("installationTask", "t1")).toBe(
      "/installations",
    );
  });

  test("opens environmental alerts at their alert episode", () => {
    expect(notificationEntityHref("alertEpisode", "ep1")).toBe(
      "/locations/episodes/ep1",
    );
  });

  test("has no link for unknown or incomplete notifications", () => {
    expect(notificationEntityHref("invoice", "i1")).toBeNull();
    expect(notificationEntityHref(undefined, "i1")).toBeNull();
    expect(notificationEntityHref("loan", undefined)).toBeNull();
  });
});
