"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  type ClimateThresholds,
  isValidClimateThresholds,
} from "@v1/backend/convex/utils/alertEpisodePolicy";
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
import { useMutation } from "convex/react";
import { Loader2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { z } from "zod";
import { useAlertEpisodeErrorMessage } from "@/hooks/use-alert-episode-error-message";
import { useScopedI18n } from "@/locales/client";

const LIMIT_FIELDS = [
  "temperatureMin",
  "temperatureMax",
  "humidityMin",
  "humidityMax",
] as const satisfies ReadonlyArray<keyof ClimateThresholds>;
type LimitField = (typeof LIMIT_FIELDS)[number];
type LimitInputs = Record<LimitField, string>;

const limitInput = z
  .string()
  .trim()
  .refine((value) => value === "" || Number.isFinite(Number(value)))
  .transform((value) => (value === "" ? undefined : Number(value)));

/** Empty fields leave a limit unset; set ones must be possible readings. */
const thresholdsForm = z
  .object({
    temperatureMin: limitInput,
    temperatureMax: limitInput,
    humidityMin: limitInput,
    humidityMax: limitInput,
  })
  .refine(isValidClimateThresholds);

function inputsFor(thresholds: ClimateThresholds | null): LimitInputs {
  return {
    temperatureMin: thresholds?.temperatureMin?.toString() ?? "",
    temperatureMax: thresholds?.temperatureMax?.toString() ?? "",
    humidityMin: thresholds?.humidityMin?.toString() ?? "",
    humidityMax: thresholds?.humidityMax?.toString() ?? "",
  };
}

interface EnvironmentThresholdsDialogProps {
  locationId: Id<"locations">;
  thresholds: ClimateThresholds | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EnvironmentThresholdsDialog(
  props: EnvironmentThresholdsDialogProps,
) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {props.open ? <ThresholdsForm {...props} /> : null}
    </Dialog>
  );
}

function ThresholdsForm({
  locationId,
  thresholds,
  onOpenChange,
}: EnvironmentThresholdsDialogProps) {
  const t = useScopedI18n("locations.environment.thresholdsDialog");
  const errorMessage = useAlertEpisodeErrorMessage();
  const setThresholds = useMutation(api.environmentalMonitoring.setThresholds);
  const [inputs, setInputs] = useState(() => inputsFor(thresholds));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = thresholdsForm.safeParse(inputs);
    if (!parsed.success) {
      setError(t("invalid"));
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await setThresholds({ locationId, thresholds: parsed.data });
      onOpenChange(false);
    } catch (cause) {
      setError(errorMessage(cause) ?? t("failed"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DialogContent>
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          {LIMIT_FIELDS.map((field) => (
            <div key={field} className="grid gap-2">
              <Label htmlFor={`environment-threshold-${field}`}>
                {t(`fields.${field}`)}
              </Label>
              <Input
                id={`environment-threshold-${field}`}
                type="number"
                inputMode="decimal"
                step="0.1"
                value={inputs[field]}
                onChange={(event) => {
                  const { value } = event.currentTarget;
                  setInputs((current) => ({ ...current, [field]: value }));
                }}
                aria-invalid={error !== null}
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {t("save")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
