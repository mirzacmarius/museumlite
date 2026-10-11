"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Checkbox } from "@v1/ui/checkbox";
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
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { ActionRefusal, type Refusal } from "@/components/action-refusal";
import { LocationSelector } from "@/components/location-selector";
import { focusFirstFieldInError } from "@/components/record-form/record-form-notices";
import { useInventoryErrorMessage } from "@/hooks/use-inventory-error-message";
import { useScopedI18n } from "@/locales/client";

const MAX_NAME_LENGTH = 120;

export function StartSessionDialog({
  organizationId,
  onOpenChange,
}: {
  organizationId: Id<"organizations">;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useScopedI18n("inventory.start");
  const tCommon = useScopedI18n("common");
  const errorMessage = useInventoryErrorMessage();
  const startSession = useMutation(api.inventory.startSession);
  const { push } = useRouter();
  const [{ name, scopeLocationId, includeSublocations }, setForm] = useState({
    name: "",
    scopeLocationId: "",
    includeSublocations: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors["inventory-session-name"] = t("nameRequired");
    if (!scopeLocationId)
      nextErrors["inventory-session-scope"] = t("scopeRequired");
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      focusFirstFieldInError(nextErrors);
      return;
    }
    setIsSaving(true);
    setRefusal(null);
    try {
      const sessionId = await startSession({
        organizationId,
        name,
        scopeLocationId: scopeLocationId as Id<"locations">,
        includeSublocations,
      });
      push(`/inventory/${sessionId}`);
    } catch (error) {
      setRefusal({ message: errorMessage(error) });
      setIsSaving(false);
    }
  }

  const nameError = errors["inventory-session-name"];
  const scopeError = errors["inventory-session-scope"];

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="inventory-session-name">{t("name")}</Label>
            <Input
              id="inventory-session-name"
              value={name}
              maxLength={MAX_NAME_LENGTH}
              placeholder={t("namePlaceholder")}
              aria-invalid={!!nameError}
              aria-describedby={
                nameError ? "inventory-session-name-error" : undefined
              }
              onChange={(event) =>
                setForm((form) => ({ ...form, name: event.target.value }))
              }
              disabled={isSaving}
            />
            {nameError ? (
              <p
                id="inventory-session-name-error"
                className="text-xs text-destructive"
              >
                {nameError}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inventory-session-scope">{t("scope")}</Label>
            <LocationSelector
              id="inventory-session-scope"
              organizationId={organizationId}
              value={scopeLocationId}
              onValueChange={(next) =>
                setForm((form) => ({ ...form, scopeLocationId: next }))
              }
              allowNone={false}
              disabled={isSaving}
              aria-invalid={!!scopeError}
              aria-describedby={
                scopeError ? "inventory-session-scope-error" : undefined
              }
            />
            {scopeError ? (
              <p
                id="inventory-session-scope-error"
                className="text-xs text-destructive"
              >
                {scopeError}
              </p>
            ) : null}
          </div>
          <div className="flex items-start gap-2">
            <Checkbox
              id="inventory-session-sublocations"
              checked={includeSublocations}
              onCheckedChange={(checked) =>
                setForm((form) => ({
                  ...form,
                  includeSublocations: checked === true,
                }))
              }
              disabled={isSaving}
            />
            <Label
              htmlFor="inventory-session-sublocations"
              className="text-sm font-normal leading-snug"
            >
              {t("includeSublocations")}
            </Label>
          </div>
          <ActionRefusal refusal={refusal} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? t("submitting") : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
