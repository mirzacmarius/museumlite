import { describe, expect, test } from "vitest";
import { notificationEntityHref } from "./notificationLinks";

describe("notificationEntityHref", () => {
  test("opens object notifications at the canonical object route", () => {
    expect(notificationEntityHref("collection", "obj123")).toBe(
      "/objects/obj123",
    );
    expect(notificationEntityHref("object", "obj123")).toBe("/objects/obj123");
  });

  test("opens case notifications at their own routes", () => {
    expect(notificationEntityHref("loan", "l1")).toBe("/loans/l1");
    expect(notificationEntityHref("accession", "a1")).toBe("/accessions/a1");
    expect(notificationEntityHref("move_request", "m1")).toBe(
      "/objects/move-requests/m1",
    );
  });

  test("opens case task notifications on the case they belong to", () => {
    expect(notificationEntityHref("exhibition", "e1")).toBe("/exhibitions/e1");
    expect(notificationEntityHref("conservationTreatment", "c1")).toBe(
      "/conservation/c1",
    );
    expect(notificationEntityHref("installationTask", "t1")).toBe(
      "/installations",
    );
  });

  test("has no link for unknown or incomplete notifications", () => {
    expect(notificationEntityHref("invoice", "i1")).toBeNull();
    expect(notificationEntityHref(undefined, "i1")).toBeNull();
    expect(notificationEntityHref("loan", undefined)).toBeNull();
  });
});
