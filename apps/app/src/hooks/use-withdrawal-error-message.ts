import { withdrawalErrorFromError } from "@v1/backend/convex/utils/withdrawalErrors";
import { useScopedI18n } from "@/locales/client";

/**
 * Translates Withdrawal (Remove item) refusals. Returns null for any other
 * failure so callers keep their own handling.
 */
export function useWithdrawalErrorMessage() {
  const t = useScopedI18n("objects.withdrawal");
  return (error: unknown): string | null => {
    switch (withdrawalErrorFromError(error)?.code) {
      case "WITHDRAWAL_REASON_REQUIRED":
        return t("reasonRequired");
      case undefined:
        return null;
    }
  };
}
