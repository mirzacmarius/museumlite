"use client";

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
import { cn } from "@v1/ui/utils";
import { useMutation, useQuery } from "convex/react";
import { Droplet, Plus, Save } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { OrganizationDeletionZone } from "./organization-deletion-zone";

type WatermarkPosition =
  | "center"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

interface WatermarkSettings {
  isEnabled: boolean;
  text: string;
  opacity: number;
  position: WatermarkPosition;
}

function OrganizationSettingsHeader({
  addOrganizationLabel,
  description,
  title,
}: {
  addOrganizationLabel: string;
  description: string;
  title: string;
}) {
  return (
    <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-medium text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Button asChild>
        <Link href="/settings/organization/new">
          <Plus className="mr-2 size-4" />
          {addOrganizationLabel}
        </Link>
      </Button>
    </div>
  );
}

function OrganizationMessageCard({ message }: { message: string }) {
  return (
    <div className="flex min-h-48 items-center justify-center rounded-lg border border-border bg-card p-6">
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}

function OrganizationSettingsError({ error }: { error: string | null }) {
  if (!error) {
    return null;
  }

  return (
    <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
      {error}
    </div>
  );
}

function BasicInformationCard({
  labels,
  name,
  onNameChange,
  organization,
}: {
  labels: {
    basicInformation: string;
    nameLabel: string;
    slugCannotChange: string;
    slugLabel: string;
    typeCannotChange: string;
    typeLabel: string;
  };
  name: string;
  onNameChange: (name: string) => void;
  organization: {
    slug: string;
    type: string;
  };
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-4 text-lg font-medium">{labels.basicInformation}</h2>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">{labels.nameLabel}</Label>
          <PermissionGate
            permission="organization.manage_settings"
            fallback={<Input id="name" value={name} disabled />}
          >
            <Input
              id="name"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              required
            />
          </PermissionGate>
        </div>
        <div className="space-y-2">
          <Label>{labels.typeLabel}</Label>
          <Input value={organization.type} disabled className="bg-muted" />
          <p className="text-xs text-muted-foreground">
            {labels.typeCannotChange}
          </p>
        </div>
        <div className="space-y-2">
          <Label>{labels.slugLabel}</Label>
          <Input value={organization.slug} disabled className="bg-muted" />
          <p className="text-xs text-muted-foreground">
            {labels.slugCannotChange}
          </p>
        </div>
      </div>
    </div>
  );
}

function WatermarkPreview({ settings }: { settings: WatermarkSettings }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Preview</p>
      <div className="relative h-32 overflow-hidden rounded border bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900">
        {settings.text ? (
          <div
            className={cn("absolute text-sm font-medium text-foreground", {
              "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2":
                settings.position === "center",
              "left-4 top-4": settings.position === "top-left",
              "right-4 top-4": settings.position === "top-right",
              "bottom-4 left-4": settings.position === "bottom-left",
              "bottom-4 right-4": settings.position === "bottom-right",
            })}
            style={{ opacity: settings.opacity }}
          >
            {settings.text}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function WatermarkSettingsCard({
  isSubmitting,
  onSave,
  onSettingsChange,
  settings,
}: {
  isSubmitting: boolean;
  onSave: () => void;
  onSettingsChange: (settings: WatermarkSettings) => void;
  settings: WatermarkSettings;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <Droplet className="size-5" />
        <h2 className="text-lg font-medium">Watermark Settings</h2>
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="watermarkEnabled">Enable Watermark</Label>
            <p className="text-xs text-muted-foreground">
              Apply watermark to edited images
            </p>
          </div>
          <Switch
            id="watermarkEnabled"
            checked={settings.isEnabled}
            onCheckedChange={(checked) =>
              onSettingsChange({
                ...settings,
                isEnabled: checked,
              })
            }
          />
        </div>

        {settings.isEnabled ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="watermarkText">Watermark Text</Label>
              <Input
                id="watermarkText"
                value={settings.text}
                onChange={(event) =>
                  onSettingsChange({
                    ...settings,
                    text: event.target.value,
                  })
                }
                placeholder="(c) Your Organization Name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="watermarkPosition">Position</Label>
              <Select
                value={settings.position}
                onValueChange={(value) =>
                  onSettingsChange({
                    ...settings,
                    position: value as WatermarkPosition,
                  })
                }
              >
                <SelectTrigger id="watermarkPosition">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="top-left">Top Left</SelectItem>
                  <SelectItem value="top-right">Top Right</SelectItem>
                  <SelectItem value="bottom-left">Bottom Left</SelectItem>
                  <SelectItem value="bottom-right">Bottom Right</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="watermarkOpacity">Opacity</Label>
                <span className="text-sm text-muted-foreground">
                  {Math.round(settings.opacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                id="watermarkOpacity"
                min={0}
                max={1}
                step={0.05}
                value={settings.opacity}
                onChange={(event) =>
                  onSettingsChange({
                    ...settings,
                    opacity: Number.parseFloat(event.target.value),
                  })
                }
                className="w-full accent-primary"
              />
            </div>

            <WatermarkPreview settings={settings} />

            <div className="flex justify-end">
              <Button
                type="button"
                onClick={onSave}
                disabled={isSubmitting || !settings.text.trim()}
              >
                <Save className="mr-2 size-4" />
                Save Watermark Settings
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function OrganizationSaveActions({
  isSubmitting,
  labels,
}: {
  isSubmitting: boolean;
  labels: {
    saveChanges: string;
    saving: string;
  };
}) {
  return (
    <div className="flex justify-end gap-4">
      <Button type="submit" disabled={isSubmitting}>
        <Save className="mr-2 size-4" />
        {isSubmitting ? labels.saving : labels.saveChanges}
      </Button>
    </div>
  );
}

export default function OrganizationSettingsPage() {
  const t = useScopedI18n("settings");
  const tCommon = useScopedI18n("common");
  const { currentOrganizationId } = useOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [watermarkSettings, setWatermarkSettings] = useState<WatermarkSettings>(
    {
      isEnabled: false,
      text: "",
      opacity: 0.5,
      position: "bottom-right" as WatermarkPosition,
    },
  );

  const organization = useQuery(
    api.organizations.get,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );
  const updateOrganization = useMutation(api.organizations.update);
  const updateWatermarkSettings = useMutation(
    api.organizations.updateWatermarkSettings,
  );

  useEffect(() => {
    if (!organization) return;
    setName(organization.name);
    setWatermarkSettings({
      isEnabled: organization.settings?.watermarkSettings?.isEnabled ?? false,
      text: organization.settings?.watermarkSettings?.text || "",
      opacity: organization.settings?.watermarkSettings?.opacity ?? 0.5,
      position:
        organization.settings?.watermarkSettings?.position || "bottom-right",
    });
  }, [organization]);

  const pageHeader = (
    <OrganizationSettingsHeader
      addOrganizationLabel={t("organization.addOrganization")}
      description={t("organization.description")}
      title={t("organization.title")}
    />
  );

  if (!currentOrganizationId) {
    return (
      <div className="flex w-full flex-col gap-6">
        {pageHeader}
        <OrganizationMessageCard message="Please select an organization to manage settings." />
      </div>
    );
  }

  if (organization === undefined) {
    return (
      <div className="flex w-full flex-col gap-6">
        {pageHeader}
        <OrganizationMessageCard message={tCommon("loading")} />
      </div>
    );
  }

  if (organization === null) {
    return (
      <div className="flex w-full flex-col gap-6">
        {pageHeader}
        <OrganizationMessageCard message={tCommon("noResults")} />
      </div>
    );
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError(t("organization.organizationNameRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      await updateOrganization({
        organizationId: currentOrganizationId as Id<"organizations">,
        name: name.trim(),
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("organization.updateError"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveWatermarkSettings = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      await updateWatermarkSettings({
        organizationId: currentOrganizationId as Id<"organizations">,
        watermarkSettings: {
          isEnabled: watermarkSettings.isEnabled,
          text: watermarkSettings.text.trim() || undefined,
          opacity: watermarkSettings.opacity,
          position: watermarkSettings.position,
        },
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update watermark settings",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
      {pageHeader}
      <form onSubmit={handleSubmit} className="space-y-6">
        <OrganizationSettingsError error={error} />

        <BasicInformationCard
          labels={{
            basicInformation: t("organization.basicInformation"),
            nameLabel: t("organization.nameLabel"),
            slugCannotChange: t("organization.slugCannotChange"),
            slugLabel: t("organization.slugLabel"),
            typeCannotChange: t("organization.typeCannotChange"),
            typeLabel: t("organization.typeLabel"),
          }}
          name={name}
          onNameChange={setName}
          organization={organization}
        />

        <PermissionGate permission="organization.manage_settings">
          <WatermarkSettingsCard
            isSubmitting={isSubmitting}
            onSave={handleSaveWatermarkSettings}
            onSettingsChange={setWatermarkSettings}
            settings={watermarkSettings}
          />

          <OrganizationSaveActions
            isSubmitting={isSubmitting}
            labels={{
              saveChanges: t("organization.saveChanges"),
              saving: t("organization.saving"),
            }}
          />

          <OrganizationDeletionZone
            organizationId={currentOrganizationId as Id<"organizations">}
            isSubOrganization={Boolean(organization.parentOrganizationId)}
          />
        </PermissionGate>
      </form>
    </div>
  );
}
