"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@v1/ui/dialog";
import { useMutation, useQuery } from "convex/react";
import { Plus, Shield, ShieldPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PermissionGate } from "@/components/permission-gate";
import { useValuationErrorMessage } from "@/hooks/use-valuation-error-message";
import { useScopedI18n } from "@/locales/client";
import { ClaimForm } from "./claim-form";
import { CoverageForm, type CoveragePolicyOption } from "./coverage-form";
import { PolicyForm } from "./policy-form";

interface PolicyChoice extends CoveragePolicyOption {
  status: string;
}

/** Create actions for policies, coverages and claims on the insurance page. */
export function InsurancePageActions({
  organizationId,
  locale,
  now,
}: {
  organizationId: Id<"organizations">;
  locale: string;
  now: number | undefined;
}) {
  const policyChoices = useQuery(
    api.insurance.listPolicyOptions,
    now === undefined ? "skip" : { organizationId, now },
  );
  const policyOptions = useMemo<PolicyChoice[]>(
    () =>
      (policyChoices?.policies ?? []).map((policy) => ({
        label: `${policy.policyNumber} · ${policy.carrier}`,
        value: policy._id,
        currency: policy.currency,
        status: policy.status,
        effectiveDate: policy.effectiveDate,
        expirationDate: policy.expirationDate,
      })),
    [policyChoices],
  );
  const coveragePolicyOptions = useMemo(
    () =>
      policyOptions.filter(
        (option) => option.status === "active" || option.status === "pending",
      ),
    [policyOptions],
  );

  return (
    <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
      <PermissionGate permission="organization.manage_settings">
        <PolicyDialog organizationId={organizationId} />
      </PermissionGate>
      <PermissionGate permission="organization.manage_settings">
        <CoverageDialog
          organizationId={organizationId}
          locale={locale}
          policies={coveragePolicyOptions}
        />
      </PermissionGate>
      <PermissionGate permission="organization.manage_settings">
        <ClaimDialog
          organizationId={organizationId}
          policyOptions={policyOptions}
        />
      </PermissionGate>
    </div>
  );
}

function PolicyDialog({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("untranslatedDashboard.insurance");
  const errorMessage = useValuationErrorMessage();
  const createPolicy = useMutation(api.insurance.createPolicy);
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="mr-2 size-4" />
          {t("addPolicy")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>{t("newPolicyTitle")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("newPolicyDescription")}
          </DialogDescription>
        </DialogHeader>
        <PolicyForm
          organizationId={organizationId}
          onSubmit={async (payload) => {
            try {
              await createPolicy(payload);
              toast.success(t("policyCreated"));
              setOpen(false);
            } catch (error) {
              toast.error(errorMessage(error, t("policyCreateFailed")));
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function CoverageDialog({
  organizationId,
  locale,
  policies,
}: {
  organizationId: Id<"organizations">;
  locale: string;
  policies: CoveragePolicyOption[];
}) {
  const t = useScopedI18n("untranslatedDashboard.insurance.coverageTab");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ShieldPlus className="mr-2 size-4" />
          {t("addCoverage")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t("addTitle")}</DialogTitle>
          <DialogDescription>{t("addDescription")}</DialogDescription>
        </DialogHeader>
        <CoverageForm
          organizationId={organizationId}
          locale={locale}
          policies={policies}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function ClaimDialog({
  organizationId,
  policyOptions,
}: {
  organizationId: Id<"organizations">;
  policyOptions: PolicyChoice[];
}) {
  const t = useScopedI18n("untranslatedDashboard.insurance");
  const errorMessage = useValuationErrorMessage();
  const createClaim = useMutation(api.insurance.createClaim);
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Shield className="mr-2 size-4" />
          {t("newClaim")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>{t("newClaimTitle")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("newClaimDescription")}
          </DialogDescription>
        </DialogHeader>
        <ClaimForm
          organizationId={organizationId}
          policyOptions={policyOptions}
          onSubmit={async (payload) => {
            try {
              await createClaim(payload);
              toast.success(t("claimCreated"));
              setOpen(false);
            } catch (error) {
              toast.error(errorMessage(error, t("claimCreateFailed")));
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
