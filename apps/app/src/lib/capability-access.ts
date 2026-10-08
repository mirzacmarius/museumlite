import type {
  CapabilityId,
  CapabilityState,
} from "@v1/backend/convex/utils/capabilities";

export type { CapabilityId, CapabilityState };

export type CapabilityStateLookup = (
  capability: CapabilityId,
) => CapabilityState | undefined;

/** How a destination appears in navigation. */
export type NavigationAccess = "open" | "locked" | "hidden";

/**
 * Plan-gated destinations stay visible but locked so their page can explain
 * the plan. Modules that are off and roles without access are hidden; a
 * dependent module can opt into the lock when its parent area is visible.
 * Unknown (still loading) states are hidden.
 */
export function navigationAccess(
  state: CapabilityState | undefined,
  { lockWhenModuleDisabled = false } = {},
): NavigationAccess {
  if (!state) return "hidden";
  switch (state.status) {
    case "available":
      return "open";
    case "tier_required":
      return "locked";
    case "module_disabled":
      return lockWhenModuleDisabled ? "locked" : "hidden";
    case "permission_missing":
      return "hidden";
  }
}

export type CapabilityGuardReason =
  | { kind: "tier_required"; tier: "pro" | "enterprise" }
  | { kind: "module_disabled" }
  | { kind: "permission_missing" };

/** The explanation a page shows for an unavailable capability; null when open. */
export function capabilityGuardReason(
  state: CapabilityState,
): CapabilityGuardReason | null {
  switch (state.status) {
    case "available":
      return null;
    case "tier_required":
      return {
        kind: "tier_required",
        tier: state.requiredTier === "enterprise" ? "enterprise" : "pro",
      };
    case "module_disabled":
      return { kind: "module_disabled" };
    case "permission_missing":
      return { kind: "permission_missing" };
  }
}
