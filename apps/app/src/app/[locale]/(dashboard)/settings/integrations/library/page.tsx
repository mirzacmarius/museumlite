"use client";

import { useOrganization } from "@/components/organization-provider";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  LibraryCardSettingsSection,
  LibraryCatalogingSection,
  LibraryCirculationSection,
  LibraryFineSettingsSection,
  LibraryHoldSettingsSection,
  LibrarySettingsHeader,
} from "./library-settings-sections";
import {
  type LibrarySettingsFormData,
  defaultLibrarySettingsFormData,
} from "./library-settings-types";

export default function LibrarySettingsPage() {
  const { currentOrganizationId } = useOrganization();
  const { hasModule } = useFeatureAccess();
  const isLibraryEnabled = hasModule("library");

  const librarySettings = useQuery(
    api.library.settings.get,
    currentOrganizationId && isLibraryEnabled
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const updateSettings = useMutation(api.library.settings.update);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<LibrarySettingsFormData>(
    defaultLibrarySettingsFormData,
  );

  useEffect(() => {
    if (librarySettings) {
      setFormData({
        defaultLoanPeriodDays: librarySettings.defaultLoanPeriodDays,
        defaultRenewalLimit: librarySettings.defaultRenewalLimit,
        renewalPeriodDays: librarySettings.renewalPeriodDays,
        maxRenewalsAllowed: librarySettings.maxRenewalsAllowed,
        finePerDayDefault: librarySettings.finePerDayDefault,
        maxFinePerItem: librarySettings.maxFinePerItem ?? 10,
        gracePeriodDays: librarySettings.gracePeriodDays,
        fineThresholdForBlock: librarySettings.fineThresholdForBlock ?? 25,
        holdExpirationDays: librarySettings.holdExpirationDays,
        maxHoldsPerPatron: librarySettings.maxHoldsPerPatron,
        cardNumberPrefix: librarySettings.cardNumberPrefix ?? "LIB",
        cardNumberLength: librarySettings.cardNumberLength ?? 10,
        autoGenerateCardNumbers: librarySettings.autoGenerateCardNumbers,
        classificationSystem: librarySettings.classificationSystem,
        dueDateReminderDays: librarySettings.dueDateReminderDays ?? 3,
      });
    }
  }, [librarySettings]);

  const handleSave = async () => {
    if (!currentOrganizationId) return;

    setIsSaving(true);
    try {
      await updateSettings({
        organizationId: currentOrganizationId as Id<"organizations">,
        ...formData,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full flex-col gap-6">
        <div className="flex w-full flex-col items-start rounded-lg border border-border bg-card p-6">
          <p className="text-muted-foreground">
            Please select an organization to manage library settings.
          </p>
        </div>
      </div>
    );
  }

  if (isLibraryEnabled === false) {
    return (
      <div className="flex size-full flex-col gap-6">
        <div className="flex w-full flex-col items-start rounded-lg border border-border bg-card p-6">
          <p className="text-muted-foreground">
            The Library integration is not enabled for this organization.
          </p>
          <Button asChild className="mt-4">
            <Link href="/settings/integrations">Enable Integration</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (librarySettings === undefined) {
    return (
      <div className="flex size-full flex-col gap-6">
        <div className="flex w-full items-center justify-center rounded-lg border border-border bg-card p-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex size-full flex-col gap-6">
      <LibrarySettingsHeader isSaving={isSaving} onSave={handleSave} />
      <LibraryCirculationSection
        formData={formData}
        setFormData={setFormData}
      />
      <LibraryFineSettingsSection
        formData={formData}
        setFormData={setFormData}
      />
      <LibraryHoldSettingsSection
        formData={formData}
        setFormData={setFormData}
      />
      <LibraryCardSettingsSection
        formData={formData}
        setFormData={setFormData}
      />
      <LibraryCatalogingSection formData={formData} setFormData={setFormData} />
    </div>
  );
}
