import { capabilityUnavailableFromError } from "@v1/backend/convex/utils/capabilities";
import { useScopedI18n } from "@/locales/client";

/**
 * Translates coded CAPABILITY_UNAVAILABLE failures from backend commands.
 * Returns null for any other error so callers keep their own handling.
 */
export function useCapabilityErrorMessage() {
  const t = useScopedI18n("capabilities");
  return (error: unknown): string | null => {
    const failure = capabilityUnavailableFromError(error);
    if (!failure) return null;
    switch (failure.reason) {
      case "module_disabled":
        return t("moduleDisabled");
      case "tier_required":
        return t("tierRequired", {
          tier:
            failure.requiredTier === "enterprise"
              ? t("tiers.enterprise")
              : t("tiers.pro"),
        });
      case "permission_missing":
        return t("permissionMissing");
    }
  };
}
