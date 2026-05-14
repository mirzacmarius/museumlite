"use client";

import { useOrganization } from "@/components/organization-provider";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Switch } from "@v1/ui/switch";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

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
  const [formData, setFormData] = useState({
    defaultLoanPeriodDays: 14,
    defaultRenewalLimit: 2,
    renewalPeriodDays: 14,
    maxRenewalsAllowed: 2,
    finePerDayDefault: 0.25,
    maxFinePerItem: 10,
    gracePeriodDays: 1,
    fineThresholdForBlock: 25,
    holdExpirationDays: 7,
    maxHoldsPerPatron: 10,
    cardNumberPrefix: "LIB",
    cardNumberLength: 10,
    autoGenerateCardNumbers: true,
    classificationSystem: "dewey" as "dewey" | "lc" | "custom",
    dueDateReminderDays: 3,
  });

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
      <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-3">
          <Button variant="ghost" size="sm" className="w-fit" asChild>
            <Link href="/settings/integrations">
              <ArrowLeft className="mr-2 size-4" />
              Back
            </Link>
          </Button>
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-medium text-foreground">
              Library Settings
            </h2>
            <p className="text-sm text-muted-foreground">
              Configure circulation policies, fines, and patron settings
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Save className="mr-2 size-4" />
          )}
          Save Changes
        </Button>
      </div>

      {/* Circulation Policies */}
      <div className="flex w-full flex-col rounded-lg border border-border bg-card">
        <div className="border-b border-border p-6">
          <h3 className="text-lg font-medium">Circulation Policies</h3>
          <p className="text-sm text-muted-foreground">
            Default settings for item checkouts and renewals
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Default Loan Period (days)</Label>
            <Input
              type="number"
              min={1}
              value={formData.defaultLoanPeriodDays}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  defaultLoanPeriodDays: Number.parseInt(e.target.value) || 14,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Renewal Period (days)</Label>
            <Input
              type="number"
              min={1}
              value={formData.renewalPeriodDays}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  renewalPeriodDays: Number.parseInt(e.target.value) || 14,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Default Renewal Limit</Label>
            <Input
              type="number"
              min={0}
              value={formData.defaultRenewalLimit}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  defaultRenewalLimit: Number.parseInt(e.target.value) || 0,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Maximum Renewals Allowed</Label>
            <Input
              type="number"
              min={0}
              value={formData.maxRenewalsAllowed}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  maxRenewalsAllowed: Number.parseInt(e.target.value) || 0,
                })
              }
            />
          </div>
        </div>
      </div>

      {/* Fine Settings */}
      <div className="flex w-full flex-col rounded-lg border border-border bg-card">
        <div className="border-b border-border p-6">
          <h3 className="text-lg font-medium">Fine Settings</h3>
          <p className="text-sm text-muted-foreground">
            Configure overdue fine rates and limits
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Fine Per Day ($)</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={formData.finePerDayDefault}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  finePerDayDefault: Number.parseFloat(e.target.value) || 0,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Maximum Fine Per Item ($)</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={formData.maxFinePerItem}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  maxFinePerItem: Number.parseFloat(e.target.value) || 0,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Grace Period (days)</Label>
            <Input
              type="number"
              min={0}
              value={formData.gracePeriodDays}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  gracePeriodDays: Number.parseInt(e.target.value) || 0,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Fine Threshold to Block Patron ($)</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={formData.fineThresholdForBlock}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  fineThresholdForBlock: Number.parseFloat(e.target.value) || 0,
                })
              }
            />
          </div>
        </div>
      </div>

      {/* Hold Settings */}
      <div className="flex w-full flex-col rounded-lg border border-border bg-card">
        <div className="border-b border-border p-6">
          <h3 className="text-lg font-medium">Hold Settings</h3>
          <p className="text-sm text-muted-foreground">
            Configure hold queue and pickup policies
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Hold Expiration (days after available)</Label>
            <Input
              type="number"
              min={1}
              value={formData.holdExpirationDays}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  holdExpirationDays: Number.parseInt(e.target.value) || 7,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Maximum Holds Per Patron</Label>
            <Input
              type="number"
              min={1}
              value={formData.maxHoldsPerPatron}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  maxHoldsPerPatron: Number.parseInt(e.target.value) || 10,
                })
              }
            />
          </div>
        </div>
      </div>

      {/* Patron Card Settings */}
      <div className="flex w-full flex-col rounded-lg border border-border bg-card">
        <div className="border-b border-border p-6">
          <h3 className="text-lg font-medium">Library Card Settings</h3>
          <p className="text-sm text-muted-foreground">
            Configure patron card number generation
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Card Number Prefix</Label>
            <Input
              value={formData.cardNumberPrefix}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  cardNumberPrefix: e.target.value,
                })
              }
              placeholder="e.g., LIB"
            />
          </div>
          <div className="space-y-2">
            <Label>Card Number Length</Label>
            <Input
              type="number"
              min={6}
              max={20}
              value={formData.cardNumberLength}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  cardNumberLength: Number.parseInt(e.target.value) || 10,
                })
              }
            />
          </div>
          <div className="flex items-center justify-between space-y-0 sm:col-span-2">
            <div>
              <Label>Auto-generate Card Numbers</Label>
              <p className="text-sm text-muted-foreground">
                Automatically generate card numbers for new patrons
              </p>
            </div>
            <Switch
              checked={formData.autoGenerateCardNumbers}
              onCheckedChange={(checked) =>
                setFormData({
                  ...formData,
                  autoGenerateCardNumbers: checked,
                })
              }
            />
          </div>
        </div>
      </div>

      {/* Classification System */}
      <div className="flex w-full flex-col rounded-lg border border-border bg-card">
        <div className="border-b border-border p-6">
          <h3 className="text-lg font-medium">Cataloging Settings</h3>
          <p className="text-sm text-muted-foreground">
            Configure cataloging and classification options
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Classification System</Label>
            <Select
              value={formData.classificationSystem}
              onValueChange={(value: "dewey" | "lc" | "custom") =>
                setFormData({
                  ...formData,
                  classificationSystem: value,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dewey">Dewey Decimal System</SelectItem>
                <SelectItem value="lc">Library of Congress</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Due Date Reminder (days before)</Label>
            <Input
              type="number"
              min={0}
              value={formData.dueDateReminderDays}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  dueDateReminderDays: Number.parseInt(e.target.value) || 3,
                })
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
