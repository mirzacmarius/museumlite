import type {
  CapabilityId,
  CapabilityState,
} from "@v1/backend/convex/utils/capabilities";
import { describe, expect, test } from "vitest";
import { buildCommandPaletteActions } from "./command-palette-actions";

function actions(
  unavailable: Partial<
    Record<CapabilityId, Omit<CapabilityState, "capability">>
  > = {},
  { isLocationTrackingEnabled = true } = {},
) {
  return buildCommandPaletteActions({
    capabilityState: (capability) =>
      ({
        capability,
        ...(unavailable[capability] ?? { status: "available" }),
      }) as CapabilityState,
    isLocationTrackingEnabled,
  });
}

function hrefs(list: ReturnType<typeof actions>) {
  return [...list.create, ...list.navigation].map((action) => action.href);
}

describe("buildCommandPaletteActions", () => {
  test("offers every destination at its canonical route when all capabilities are available", () => {
    expect(hrefs(actions())).toEqual([
      "/objects/new",
      "/accessions/new",
      "/loans/new",
      "/collections/new",
      "/",
      "/objects",
      "/collections",
      "/accessions",
      "/loans",
      "/locations",
      "/library",
      "/settings/organization",
    ]);
  });

  test("leaves out loan commands on a plan without loans", () => {
    const result = hrefs(
      actions({ loans: { status: "tier_required", requiredTier: "pro" } }),
    );

    expect(result).not.toContain("/loans");
    expect(result).not.toContain("/loans/new");
  });

  test("leaves out the library while its module is off", () => {
    expect(
      hrefs(
        actions({ library: { status: "module_disabled", module: "library" } }),
      ),
    ).not.toContain("/library");
  });

  test("leaves out settings for members who are not administrators", () => {
    expect(
      hrefs(actions({ administration: { status: "permission_missing" } })),
    ).not.toContain("/settings/organization");
  });

  test("leaves out locations when location tracking is off", () => {
    expect(
      hrefs(actions({}, { isLocationTrackingEnabled: false })),
    ).not.toContain("/locations");
  });
});
