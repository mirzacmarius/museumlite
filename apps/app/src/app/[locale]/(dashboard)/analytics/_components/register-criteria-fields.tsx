"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { APPRAISAL_PURPOSE_ORDER } from "@v1/backend/convex/utils/valuation";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { useQuery } from "convex/react";
import { usePermissions } from "@/components/permission-gate";
import { useClientNow } from "@/hooks/use-client-date-format";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useRegisterValueLabels } from "@/hooks/use-register-value-labels";
import { useScopedI18n } from "@/locales/client";
import {
  acceptsCriterion,
  INVENTORY_SCOPES,
  type InventoryScope,
  type Purpose,
  type RegisterForm,
  STATUSES,
  type Status,
} from "./register-criteria";

const selectClassName =
  "h-9 w-full rounded-md border border-input bg-background px-2 disabled:opacity-50";

function isStatus(value: string): value is Status {
  return STATUSES.some((status) => status === value);
}
function isPurpose(value: string): value is Purpose {
  return APPRAISAL_PURPOSE_ORDER.some((purpose) => purpose === value);
}
function isInventoryScope(value: string): value is InventoryScope {
  return INVENTORY_SCOPES.some((scope) => scope === value);
}

/** Policies to schedule, for members who can read insurance. */
function usePolicyOptions(
  organizationId: Id<"organizations">,
  wanted: boolean,
) {
  const { hasPermission } = usePermissions();
  const { hasFeature } = useFeatureAccess();
  const now = useClientNow();
  const allowed =
    hasPermission("loans.read") && hasFeature("loans", organizationId);
  return useQuery(
    api.insurance.listPolicyOptions,
    wanted && allowed && now !== undefined ? { organizationId, now } : "skip",
  );
}

interface RegisterCriteriaFieldsProps {
  organizationId: Id<"organizations">;
  form: RegisterForm;
  update: (patch: Partial<RegisterForm>) => void;
}

/** Inputs for the criteria the selected register or report accepts. */
export function RegisterCriteriaFields({
  organizationId,
  form,
  update,
}: RegisterCriteriaFieldsProps) {
  const t = useScopedI18n("registerReports");
  const valueLabels = useRegisterValueLabels();
  const accepts = (field: Parameters<typeof acceptsCriterion>[1]) =>
    acceptsCriterion(form.profile, field);
  const policies = usePolicyOptions(organizationId, accepts("policyId"));
  const statusLabels: Record<Status, string> = {
    pending: t("statusPending"),
    approved: t("statusApproved"),
    rejected: t("statusRejected"),
  };

  return (
    <>
      {accepts("fromDate") && (
        <div className="space-y-1">
          <Label htmlFor="register-from">{t("fromDate")}</Label>
          <Input
            id="register-from"
            type="date"
            value={form.fromDate}
            onChange={(e) => update({ fromDate: e.target.value })}
          />
        </div>
      )}
      {accepts("toDate") && (
        <div className="space-y-1">
          <Label htmlFor="register-to">{t("toDate")}</Label>
          <Input
            id="register-to"
            type="date"
            value={form.toDate}
            onChange={(e) => update({ toDate: e.target.value })}
          />
        </div>
      )}
      {accepts("status") && (
        <div className="space-y-1">
          <Label htmlFor="register-status">{t("status")}</Label>
          <select
            id="register-status"
            value={form.status}
            onChange={(e) =>
              update({
                status: isStatus(e.target.value) ? e.target.value : "",
              })
            }
            className={selectClassName}
          >
            <option value="">{t("statusAny")}</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
        </div>
      )}
      {accepts("purpose") && (
        <div className="space-y-1">
          <Label htmlFor="register-purpose">{t("purpose")}</Label>
          <select
            id="register-purpose"
            value={form.purpose}
            onChange={(e) =>
              update({
                purpose: isPurpose(e.target.value) ? e.target.value : "",
              })
            }
            className={selectClassName}
          >
            <option value="">{t("purposeAny")}</option>
            {APPRAISAL_PURPOSE_ORDER.map((purpose) => (
              <option key={purpose} value={purpose}>
                {valueLabels.purpose[purpose]}
              </option>
            ))}
          </select>
        </div>
      )}
      {accepts("inventoryScope") && (
        <div className="space-y-1">
          <Label htmlFor="register-scope">{t("inventoryScope")}</Label>
          <select
            id="register-scope"
            value={form.inventoryScope}
            onChange={(e) =>
              update({
                inventoryScope: isInventoryScope(e.target.value)
                  ? e.target.value
                  : "",
              })
            }
            className={selectClassName}
          >
            <option value="">{t("scopeAny")}</option>
            {INVENTORY_SCOPES.map((scope) => (
              <option key={scope} value={scope}>
                {valueLabels.inventoryScope[scope]}
              </option>
            ))}
          </select>
        </div>
      )}
      {accepts("policyId") && (
        <div className="space-y-1">
          <Label htmlFor="register-policy">{t("policy")}</Label>
          <select
            id="register-policy"
            value={form.policyId}
            disabled={!policies}
            onChange={(e) =>
              update({
                policyId:
                  policies?.policies.find(
                    (policy) => policy._id === e.target.value,
                  )?._id ?? "",
              })
            }
            className={selectClassName}
          >
            <option value="">{t("policyAny")}</option>
            {policies?.policies.map((policy) => (
              <option key={policy._id} value={policy._id}>
                {t("policyOption", {
                  number: policy.policyNumber,
                  carrier: policy.carrier,
                })}
              </option>
            ))}
          </select>
        </div>
      )}
      {accepts("currency") && (
        <div className="space-y-1">
          <Label htmlFor="register-currency">{t("currency")}</Label>
          <Input
            id="register-currency"
            value={form.currency}
            maxLength={3}
            autoCapitalize="characters"
            placeholder={t("currencyPlaceholder")}
            onChange={(e) => update({ currency: e.target.value })}
          />
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor="register-as-of">{t("asOf")}</Label>
        <Input
          id="register-as-of"
          type="datetime-local"
          value={form.asOf}
          onChange={(e) => update({ asOf: e.target.value })}
        />
      </div>
    </>
  );
}
