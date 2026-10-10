import type { classifyInventoryRecord } from "@v1/backend/convex/utils/collectionMetrics";
import type { CoverageState } from "@v1/backend/convex/utils/insuranceCoverage";
import type { AppraisalPurpose } from "@v1/backend/convex/utils/valuation";
import { useScopedI18n } from "@/locales/client";

type InventoryScope = ReturnType<typeof classifyInventoryRecord>;

/**
 * Translated values of the report columns that criteria filter and totals
 * group by, keyed by column name.
 */
export function useRegisterValueLabels() {
  const t = useScopedI18n("registerReports");
  const tPurpose = useScopedI18n("valuation.purposes");
  const tState = useScopedI18n(
    "untranslatedDashboard.insurance.coverageTab.states",
  );
  const purpose: Record<AppraisalPurpose, string> = {
    insurance: tPurpose("insurance"),
    replacement: tPurpose("replacement"),
    market: tPurpose("market"),
    fair_market: tPurpose("fair_market"),
    liquidation: tPurpose("liquidation"),
  };
  const inventoryScope: Record<InventoryScope, string> = {
    owned: t("scopeOwned"),
    incoming: t("scopeIncoming"),
    unclassified: t("scopeUnclassified"),
    excluded: t("scopeExcluded"),
  };
  const stateAsOf: Record<CoverageState, string> = {
    in_force: tState("in_force"),
    not_started: tState("not_started"),
    expired: tState("expired"),
    policy_inactive: tState("policy_inactive"),
    removed: tState("removed"),
    needs_review: tState("needs_review"),
  };
  return { purpose, inventoryScope, stateAsOf };
}
