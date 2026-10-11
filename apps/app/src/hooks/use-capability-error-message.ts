import {
  type CapabilityUnavailableReason,
  capabilityUnavailableFromError,
} from "@v1/backend/convex/utils/capabilities";
import type { SubscriptionTier } from "@v1/backend/convex/utils/featurePolicy";
import type { CapabilityState } from "@/lib/capability-access";
import { useScopedI18n } from "@/locales/client";

/** Same copy as the page guard for a capability's unavailable reason. */
function useReasonMessage() {
  const t = useScopedI18n("ui.featureGuard");
  return (
    reason: CapabilityUnavailableReason,
    requiredTier?: SubscriptionTier,
  ): string => {
    switch (reason) {
      case "module_disabled":
        return t("moduleDisabled");
      case "tier_required":
        return t("tierRequired", {
          tier:
            requiredTier === "enterprise"
              ? t("tiers.enterprise")
              : t("tiers.pro"),
        });
      case "permission_missing":
        return t("permissionMissing");
    }
  };
}

/**
 * Translates coded CAPABILITY_UNAVAILABLE failures from backend commands with
 * the same copy as the page guard. Returns null for any other error so
 * callers keep their own handling.
 */
export function useCapabilityErrorMessage() {
  const reasonMessage = useReasonMessage();
  return (error: unknown): string | null => {
    const failure = capabilityUnavailableFromError(error);
    if (!failure) return null;
    return reasonMessage(failure.reason, failure.requiredTier);
  };
}

/** Why a command is unavailable, with the same copy; null when available. */
export function useCapabilityStateMessage() {
  const reasonMessage = useReasonMessage();
  return (state: CapabilityState): string | null =>
    state.status === "available"
      ? null
      : reasonMessage(
          state.status,
          state.status === "tier_required" ? state.requiredTier : undefined,
        );
}
