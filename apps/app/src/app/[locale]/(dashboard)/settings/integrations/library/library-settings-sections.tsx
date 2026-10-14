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
import { useScopedI18n } from "@/locales/client";
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
  const t = useScopedI18n("untranslatedDashboard.settings");
  return (
    <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-3">
        <Button variant="ghost" size="sm" className="w-fit" asChild>
          <Link href="/settings/integrations">
            <ArrowLeft className="mr-2 size-4" />
            {t("back")}
          </Link>
        </Button>
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-medium text-foreground">
            {t("librarySettings")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("librarySettingsDescription")}
          </p>
        </div>
      </div>
      <Button onClick={onSave} disabled={isSaving}>
        {isSaving ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Save className="mr-2 size-4" />
        )}
        {t("saveChanges")}
      </Button>
    </div>
  );
}

export function LibraryCirculationSection({
  formData,
  setFormData,
}: LibrarySettingsSectionProps) {
  const t = useScopedI18n("untranslatedDashboard.settings");
  return (
    <div className="flex w-full flex-col rounded-lg border border-border bg-card">
      <div className="border-b border-border p-6">
        <h3 className="text-lg font-medium">{t("circulationPolicies")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("checkoutRenewalDefaults")}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t("defaultLoanPeriod")}</Label>
          <Input
            type="number"
            min={1}
            value={formData.defaultLoanPeriodDays}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                defaultLoanPeriodDays:
                  Number.parseInt(e.target.value, 10) || 14,
              }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label>{t("renewalPeriod")}</Label>
          <Input
            type="number"
            min={1}
            value={formData.renewalPeriodDays}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                renewalPeriodDays: Number.parseInt(e.target.value, 10) || 14,
              }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label>{t("defaultRenewalLimit")}</Label>
          <Input
            type="number"
            min={0}
            value={formData.defaultRenewalLimit}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                defaultRenewalLimit: Number.parseInt(e.target.value, 10) || 0,
              }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label>{t("maximumRenewals")}</Label>
          <Input
            type="number"
            min={0}
            value={formData.maxRenewalsAllowed}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                maxRenewalsAllowed: Number.parseInt(e.target.value, 10) || 0,
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
  const t = useScopedI18n("untranslatedDashboard.settings");
  return (
    <div className="flex w-full flex-col rounded-lg border border-border bg-card">
      <div className="border-b border-border p-6">
        <h3 className="text-lg font-medium">{t("fineSettings")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("fineSettingsDescription")}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t("finePerDay")}</Label>
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
          <Label>{t("maxFinePerItem")}</Label>
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
          <Label>{t("gracePeriod")}</Label>
          <Input
            type="number"
            min={0}
            value={formData.gracePeriodDays}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                gracePeriodDays: Number.parseInt(e.target.value, 10) || 0,
              }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label>{t("fineThreshold")}</Label>
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
  const t = useScopedI18n("untranslatedDashboard.settings");
  return (
    <div className="flex w-full flex-col rounded-lg border border-border bg-card">
      <div className="border-b border-border p-6">
        <h3 className="text-lg font-medium">{t("holdSettings")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("holdSettingsDescription")}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t("holdExpiration")}</Label>
          <Input
            type="number"
            min={1}
            value={formData.holdExpirationDays}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                holdExpirationDays: Number.parseInt(e.target.value, 10) || 7,
              }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label>{t("maxHolds")}</Label>
          <Input
            type="number"
            min={1}
            value={formData.maxHoldsPerPatron}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                maxHoldsPerPatron: Number.parseInt(e.target.value, 10) || 10,
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
  const t = useScopedI18n("untranslatedDashboard.settings");
  return (
    <div className="flex w-full flex-col rounded-lg border border-border bg-card">
      <div className="border-b border-border p-6">
        <h3 className="text-lg font-medium">{t("libraryCardSettings")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("libraryCardDescription")}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t("cardNumberPrefix")}</Label>
          <Input
            value={formData.cardNumberPrefix}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                cardNumberPrefix: e.target.value,
              }))
            }
            placeholder="LIB"
          />
        </div>
        <div className="space-y-2">
          <Label>{t("cardNumberLength")}</Label>
          <Input
            type="number"
            min={6}
            max={20}
            value={formData.cardNumberLength}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                cardNumberLength: Number.parseInt(e.target.value, 10) || 10,
              }))
            }
          />
        </div>
        <div className="flex items-center justify-between gap-y-0 sm:col-span-2">
          <div>
            <Label>{t("autoGenerateCardNumbers")}</Label>
            <p className="text-sm text-muted-foreground">
              {t("autoGenerateCardNumbersDescription")}
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
  const t = useScopedI18n("untranslatedDashboard.settings");
  return (
    <div className="flex w-full flex-col rounded-lg border border-border bg-card">
      <div className="border-b border-border p-6">
        <h3 className="text-lg font-medium">{t("catalogingSettings")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("catalogingDescription")}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t("classificationSystem")}</Label>
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
              <SelectItem value="dewey">{t("deweyDecimal")}</SelectItem>
              <SelectItem value="lc">{t("libraryOfCongress")}</SelectItem>
              <SelectItem value="custom">{t("custom")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("dueDateReminder")}</Label>
          <Input
            type="number"
            min={0}
            value={formData.dueDateReminderDays}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                dueDateReminderDays: Number.parseInt(e.target.value, 10) || 3,
              }))
            }
          />
        </div>
      </div>
    </div>
  );
}
