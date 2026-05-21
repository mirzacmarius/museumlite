"use client";

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
import { ArrowLeft, Loader2, Save } from "lucide-react";
import Link from "next/link";
import type { LibrarySettingsFormData } from "./library-settings-types";

interface LibrarySettingsSectionProps {
  formData: LibrarySettingsFormData;
  setFormData: React.Dispatch<React.SetStateAction<LibrarySettingsFormData>>;
}

export function LibrarySettingsHeader({
  isSaving,
  onSave,
}: {
  isSaving: boolean;
  onSave: () => void;
}) {
  return (
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
      <Button onClick={onSave} disabled={isSaving}>
        {isSaving ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Save className="mr-2 size-4" />
        )}
        Save Changes
      </Button>
    </div>
  );
}

export function LibraryCirculationSection({
  formData,
  setFormData,
}: LibrarySettingsSectionProps) {
  return (
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
              setFormData((prev) => ({
                ...prev,
                defaultLoanPeriodDays: Number.parseInt(e.target.value) || 14,
              }))
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
              setFormData((prev) => ({
                ...prev,
                renewalPeriodDays: Number.parseInt(e.target.value) || 14,
              }))
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
              setFormData((prev) => ({
                ...prev,
                defaultRenewalLimit: Number.parseInt(e.target.value) || 0,
              }))
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
              setFormData((prev) => ({
                ...prev,
                maxRenewalsAllowed: Number.parseInt(e.target.value) || 0,
              }))
            }
          />
        </div>
      </div>
    </div>
  );
}

export function LibraryFineSettingsSection({
  formData,
  setFormData,
}: LibrarySettingsSectionProps) {
  return (
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
              setFormData((prev) => ({
                ...prev,
                finePerDayDefault: Number.parseFloat(e.target.value) || 0,
              }))
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
              setFormData((prev) => ({
                ...prev,
                maxFinePerItem: Number.parseFloat(e.target.value) || 0,
              }))
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
              setFormData((prev) => ({
                ...prev,
                gracePeriodDays: Number.parseInt(e.target.value) || 0,
              }))
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
              setFormData((prev) => ({
                ...prev,
                fineThresholdForBlock: Number.parseFloat(e.target.value) || 0,
              }))
            }
          />
        </div>
      </div>
    </div>
  );
}

export function LibraryHoldSettingsSection({
  formData,
  setFormData,
}: LibrarySettingsSectionProps) {
  return (
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
              setFormData((prev) => ({
                ...prev,
                holdExpirationDays: Number.parseInt(e.target.value) || 7,
              }))
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
              setFormData((prev) => ({
                ...prev,
                maxHoldsPerPatron: Number.parseInt(e.target.value) || 10,
              }))
            }
          />
        </div>
      </div>
    </div>
  );
}

export function LibraryCardSettingsSection({
  formData,
  setFormData,
}: LibrarySettingsSectionProps) {
  return (
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
              setFormData((prev) => ({
                ...prev,
                cardNumberPrefix: e.target.value,
              }))
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
              setFormData((prev) => ({
                ...prev,
                cardNumberLength: Number.parseInt(e.target.value) || 10,
              }))
            }
          />
        </div>
        <div className="flex items-center justify-between gap-y-0 sm:col-span-2">
          <div>
            <Label>Auto-generate Card Numbers</Label>
            <p className="text-sm text-muted-foreground">
              Automatically generate card numbers for new patrons
            </p>
          </div>
          <Switch
            checked={formData.autoGenerateCardNumbers}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({
                ...prev,
                autoGenerateCardNumbers: checked,
              }))
            }
          />
        </div>
      </div>
    </div>
  );
}

export function LibraryCatalogingSection({
  formData,
  setFormData,
}: LibrarySettingsSectionProps) {
  return (
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
              setFormData((prev) => ({
                ...prev,
                classificationSystem: value,
              }))
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
              setFormData((prev) => ({
                ...prev,
                dueDateReminderDays: Number.parseInt(e.target.value) || 3,
              }))
            }
          />
        </div>
      </div>
    </div>
  );
}
