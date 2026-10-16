"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@v1/ui/alert-dialog";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmedSwitch } from "@/components/confirmed-switch";
import { useI18n } from "@/locales/client";

type Translate = (key: string) => string;

export type CounterScope = "global" | "year" | "month" | "day";

export function PreferencesPageHeader() {
  const tRoot = useI18n();
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xl font-medium text-foreground">
        {tRoot("untranslatedDashboard.settings.preferences")}
      </h2>
      <p className="text-sm text-muted-foreground">
        {tRoot("untranslatedDashboard.settings.preferencesDescription")}
      </p>
    </div>
  );
}

export function SettingsSection({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="mb-5 space-y-1">
        <h2 className="text-lg font-medium">{title}</h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function PreferenceSwitch({
  checked,
  description,
  id,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  description: string;
  id: string;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  const labelId = `${id}-label`;
  const descriptionId = `${id}-description`;
  return (
    <div className="flex items-center justify-between gap-6 rounded-lg border border-border/70 bg-secondary/20 p-4">
      <div className="space-y-1">
        <p id={labelId} className="text-sm leading-none font-medium">
          {label}
        </p>
        <p
          id={descriptionId}
          className="max-w-2xl text-sm text-muted-foreground"
        >
          {description}
        </p>
      </div>
      <ConfirmedSwitch
        id={id}
        labelId={labelId}
        descriptionId={descriptionId}
        settingName={label}
        checked={checked}
        onConfirmedChange={onCheckedChange}
      />
    </div>
  );
}

export function LocationTypesEditor({
  locationTypes,
  onChange,
}: {
  locationTypes: string[];
  onChange: (locationTypes: string[]) => void;
}) {
  const tRoot = useI18n();
  const [newLocationType, setNewLocationType] = useState("");

  const addLocationType = () => {
    const trimmed = newLocationType.trim();
    if (!trimmed) return;
    if (
      locationTypes.some((type) => type.toLowerCase() === trimmed.toLowerCase())
    ) {
      setNewLocationType("");
      return;
    }
    onChange([...locationTypes, trimmed]);
    setNewLocationType("");
  };

  return (
    <div className="space-y-3">
      <Label>{tRoot("untranslatedDashboard.settings.locationTypes")}</Label>
      <div className="flex gap-2">
        <Input
          value={newLocationType}
          onChange={(event) => setNewLocationType(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addLocationType();
            }
          }}
          placeholder={tRoot(
            "untranslatedDashboard.settings.locationTypesPlaceholder",
          )}
        />
        <Button type="button" variant="outline" onClick={addLocationType}>
          <Plus className="mr-2 size-4" />
          {tRoot("untranslatedRecords.objects.actions.add")}
        </Button>
      </div>
      {locationTypes.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {locationTypes.map((type) => (
            <div
              key={type}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-1"
            >
              <span className="text-sm">{type}</span>
              <button
                type="button"
                onClick={() =>
                  onChange(locationTypes.filter((item) => item !== type))
                }
                className="text-muted-foreground hover:text-destructive"
                aria-label={tRoot("untranslatedDashboard.settings.deleteType", {
                  type,
                })}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {tRoot("untranslatedDashboard.settings.noCustomLocationTypes")}
        </p>
      )}
    </div>
  );
}

export function PreferencesPageShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full flex-col gap-6">
      <PreferencesPageHeader />
      {children}
    </div>
  );
}

export function PreferencesStatusPanel({ message }: { message: string }) {
  return (
    <div className="flex min-h-48 items-center justify-center rounded-lg border border-border bg-card p-6">
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}

export function PreferencesSaveTemplateDialog({
  accessionNumberFormat,
  isOpen,
  isUpdate,
  onOpenChange,
  onSave,
  preview,
  saveTemplateDesc,
  saveTemplateName,
  setSaveTemplateDesc,
  setSaveTemplateName,
  t,
}: {
  accessionNumberFormat: string;
  isOpen: boolean;
  isUpdate: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  preview?: string;
  saveTemplateDesc: string;
  saveTemplateName: string;
  setSaveTemplateDesc: (value: string) => void;
  setSaveTemplateName: (value: string) => void;
  t: Translate;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isUpdate
              ? t("organization.templateDialog.updateTemplate")
              : t("organization.templateDialog.saveTemplate")}
          </DialogTitle>
          <DialogDescription>
            {isUpdate
              ? t("organization.templateDialog.updateDescription")
              : t("organization.templateDialog.saveDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="templateName">
              {t("organization.templateDialog.templateName")}
            </Label>
            <Input
              id="templateName"
              value={saveTemplateName}
              onChange={(event) => setSaveTemplateName(event.target.value)}
              placeholder={t(
                "organization.templateDialog.templateNamePlaceholder",
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="templateDesc">
              {t("organization.templateDialog.description")}
            </Label>
            <Textarea
              id="templateDesc"
              value={saveTemplateDesc}
              onChange={(event) => setSaveTemplateDesc(event.target.value)}
              placeholder={t(
                "organization.templateDialog.descriptionPlaceholder",
              )}
              rows={3}
            />
          </div>
          <div className="rounded-md bg-secondary p-3">
            <Label className="text-xs text-muted-foreground">
              {t("organization.templateDialog.templateFormat")}
            </Label>
            <code className="mt-1 block font-mono text-sm">
              {accessionNumberFormat}
            </code>
            {preview ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {t("organization.templateDialog.preview")}{" "}
                <code className="font-mono">{preview}</code>
              </p>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setSaveTemplateName("");
              setSaveTemplateDesc("");
            }}
          >
            {t("organization.templateDialog.cancel")}
          </Button>
          <Button type="button" onClick={onSave}>
            {isUpdate
              ? t("organization.templateDialog.update")
              : t("organization.templateDialog.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PreferencesDeleteTemplateDialog({
  deleteTemplateId,
  onClose,
  onConfirm,
  t,
}: {
  deleteTemplateId: Id<"accessionTemplates"> | null;
  onClose: () => void;
  onConfirm: () => void;
  t: Translate;
}) {
  return (
    <AlertDialog open={!!deleteTemplateId} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("organization.deleteTemplateDialog.title")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("organization.deleteTemplateDialog.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {t("organization.deleteTemplateDialog.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {t("organization.deleteTemplateDialog.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
