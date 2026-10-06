"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { DatePickerInput } from "@v1/ui/date-picker";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { useState } from "react";
import { toast } from "sonner";
import { useScopedI18n } from "@/locales/client";

export function ClaimForm({
  organizationId,
  policyOptions,
  onSubmit,
}: {
  organizationId: Id<"organizations">;
  policyOptions: Array<{ label: string; value: Id<"insurancePolicies"> }>;
  onSubmit: (payload: {
    organizationId: Id<"organizations">;
    policyId: Id<"insurancePolicies">;
    incidentDate: number;
    incidentType:
      | "damage"
      | "theft"
      | "loss"
      | "fire"
      | "water"
      | "vandalism"
      | "natural_disaster"
      | "transit"
      | "other";
    incidentDescription: string;
    claimedAmount: number;
    incidentLocation?: string;
  }) => Promise<void>;
}) {
  const t = useScopedI18n("untranslatedDashboard.insurance");
  const [form, setForm] = useState({
    policyId: "",
    incidentDate: "",
    incidentType: "damage" as
      | "damage"
      | "theft"
      | "loss"
      | "fire"
      | "water"
      | "vandalism"
      | "natural_disaster"
      | "transit"
      | "other",
    incidentLocation: "",
    incidentDescription: "",
    claimedAmount: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !form.policyId ||
      !form.incidentDate ||
      !form.incidentDescription ||
      !form.claimedAmount
    ) {
      toast.error(t("requiredFieldsError"));
      return;
    }

    const incidentDate = Date.parse(form.incidentDate);
    if (Number.isNaN(incidentDate)) {
      toast.error(t("validIncidentDateError"));
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        organizationId,
        policyId: form.policyId as Id<"insurancePolicies">,
        incidentDate,
        incidentType: form.incidentType,
        incidentDescription: form.incidentDescription.trim(),
        claimedAmount: Number.parseFloat(form.claimedAmount),
        incidentLocation: form.incidentLocation.trim() || undefined,
      });
      setForm({
        policyId: "",
        incidentDate: "",
        incidentType: "damage",
        incidentLocation: "",
        incidentDescription: "",
        claimedAmount: "",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label>{t("policyRequiredLabel")}</Label>
        <Select
          value={form.policyId}
          onValueChange={(value) =>
            setForm((prev) => ({ ...prev, policyId: value }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder={t("selectPolicy")} />
          </SelectTrigger>
          <SelectContent>
            {policyOptions.length === 0 && (
              <SelectItem value="none" disabled>
                {t("noPoliciesFound")}
              </SelectItem>
            )}
            {policyOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <DatePickerInput
          label={t("incidentDateRequiredLabel")}
          id="incidentDate"
          value={form.incidentDate}
          onChange={(value) =>
            setForm((prev) => ({ ...prev, incidentDate: value }))
          }
        />
        <div className="space-y-2">
          <Label>{t("incidentTypeRequiredLabel")}</Label>
          <Select
            value={form.incidentType}
            onValueChange={(value) =>
              setForm((prev) => ({
                ...prev,
                incidentType: value as typeof form.incidentType,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="damage">{t("incidentDamage")}</SelectItem>
              <SelectItem value="theft">{t("incidentTheft")}</SelectItem>
              <SelectItem value="loss">{t("incidentLoss")}</SelectItem>
              <SelectItem value="fire">{t("incidentFire")}</SelectItem>
              <SelectItem value="water">{t("incidentWater")}</SelectItem>
              <SelectItem value="vandalism">{t("incidentVandalism")}</SelectItem>
              <SelectItem value="natural_disaster">{t("incidentNaturalDisaster")}</SelectItem>
              <SelectItem value="transit">{t("incidentTransit")}</SelectItem>
              <SelectItem value="other">{t("other")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="incidentLocation">{t("incidentLocation")}</Label>
        <Input
          id="incidentLocation"
          value={form.incidentLocation}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              incidentLocation: event.target.value,
            }))
          }
          placeholder={t("incidentLocationPlaceholder")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="incidentDescription">
          {t("incidentDescriptionRequiredLabel")}
        </Label>
        <Input
          id="incidentDescription"
          value={form.incidentDescription}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              incidentDescription: event.target.value,
            }))
          }
          placeholder={t("incidentDescriptionPlaceholder")}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="claimedAmount">{t("claimedAmountRequiredLabel")}</Label>
        <Input
          id="claimedAmount"
          type="number"
          min="0"
          value={form.claimedAmount}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, claimedAmount: event.target.value }))
          }
          placeholder="25000"
          required
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={isSubmitting || policyOptions.length === 0}
        >
          {isSubmitting ? t("creating") : t("createClaim")}
        </Button>
      </div>
    </form>
  );
}
