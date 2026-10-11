"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type {
  IncidentImpact,
  IncidentKind,
} from "@v1/backend/convex/utils/incidentValidators";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Switch } from "@v1/ui/switch";
import { Textarea } from "@v1/ui/textarea";
import { useMutation } from "convex/react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { CollectionMultiSelectCombobox } from "@/components/collection-multi-select-combobox";
import { LocationSelector } from "@/components/location-selector";
import { useWorkErrorMessage } from "@/hooks/use-work-error-message";
import { useScopedI18n } from "@/locales/client";
import {
  fromLocalInputValue,
  INCIDENT_IMPACTS,
  INCIDENT_KINDS,
  toLocalInputValue,
} from "./incident-format";

const TITLE_MAX_LENGTH = 200;
const TEXT_MAX_LENGTH = 4000;

interface ReportIncidentDialogProps {
  organizationId: Id<"organizations">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Reporting from an alert episode: its location is added by the server. */
  alertEpisodeId?: Id<"alertEpisodes">;
  defaultKind?: IncidentKind;
  defaultTitle?: string;
  defaultLocationId?: Id<"locations">;
  defaultObjectIds?: Id<"collections">[];
}

export function ReportIncidentDialog(props: ReportIncidentDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {props.open ? <ReportIncidentForm {...props} /> : null}
    </Dialog>
  );
}

type FieldErrors = Partial<Record<"title" | "where" | "times", string>>;

function ReportIncidentForm({
  organizationId,
  onOpenChange,
  alertEpisodeId,
  defaultKind,
  defaultTitle,
  defaultLocationId,
  defaultObjectIds,
}: ReportIncidentDialogProps) {
  const t = useScopedI18n("incidents.report");
  const tIncidents = useScopedI18n("incidents");
  const errorMessage = useWorkErrorMessage();
  const router = useRouter();
  const report = useMutation(api.incidents.report);
  // One key per opened form, so a retried or double submit is one incident.
  const [intakeKey] = useState(() => crypto.randomUUID());
  const [now] = useState(() => Date.now());
  const [kind, setKind] = useState<IncidentKind>(defaultKind ?? "damage");
  const [title, setTitle] = useState(defaultTitle ?? "");
  const [description, setDescription] = useState("");
  const [discoveredAt, setDiscoveredAt] = useState(toLocalInputValue(now));
  const [occurredAt, setOccurredAt] = useState("");
  const [locationId, setLocationId] = useState<string>(
    defaultLocationId ?? "__none__",
  );
  const [objectIds, setObjectIds] = useState<string[]>(defaultObjectIds ?? []);
  const [impact, setImpact] = useState<IncidentImpact>("at_risk");
  const [sensitive, setSensitive] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    const trimmed = title.trim();
    if (!trimmed || trimmed.length > TITLE_MAX_LENGTH)
      next.title = t("errors.title");
    if (!alertEpisodeId && locationId === "__none__" && objectIds.length === 0)
      next.where = t("errors.where");
    const discovered = fromLocalInputValue(discoveredAt);
    const occurred = occurredAt ? fromLocalInputValue(occurredAt) : undefined;
    if (
      discovered === null ||
      discovered > Date.now() + 5 * 60 * 1000 ||
      occurred === null ||
      (occurred !== undefined && occurred > discovered)
    )
      next.times = t("errors.times");
    return next;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = validate();
    setErrors(next);
    setFailure(null);
    const firstInvalid = (["title", "where", "times"] as const).find(
      (field) => next[field],
    );
    if (firstInvalid) {
      document.getElementById(`report-incident-${firstInvalid}`)?.focus();
      return;
    }
    setSaving(true);
    try {
      const result = await report({
        organizationId,
        intakeKey,
        kind,
        title: title.trim(),
        description: description.trim() || undefined,
        discoveredAt: fromLocalInputValue(discoveredAt) ?? Date.now(),
        occurredAt: occurredAt
          ? (fromLocalInputValue(occurredAt) ?? undefined)
          : undefined,
        locationIds:
          locationId === "__none__" ? [] : [locationId as Id<"locations">],
        collectionIds: objectIds as Id<"collections">[],
        impact,
        sensitive,
        alertEpisodeId,
      });
      onOpenChange(false);
      if (result.duplicate && !result.visible) {
        toast.info(t("alreadyReportedRestricted"));
        return;
      }
      toast.success(result.duplicate ? t("alreadyReported") : t("reported"));
      router.push(`/incidents/${result.incidentId}`);
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {alertEpisodeId ? t("fromEpisode") : t("description")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="report-incident-kind">{t("kind")}</Label>
            <Select
              value={kind}
              onValueChange={(value) => setKind(value as IncidentKind)}
            >
              <SelectTrigger id="report-incident-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INCIDENT_KINDS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {tIncidents(`kinds.${option}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="report-incident-location">{t("location")}</Label>
            <LocationSelector
              id="report-incident-location"
              organizationId={organizationId}
              value={locationId}
              onValueChange={setLocationId}
              placeholder={t("locationPlaceholder")}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="report-incident-title">{t("whatHappened")}</Label>
          <Input
            id="report-incident-title"
            value={title}
            maxLength={TITLE_MAX_LENGTH}
            onChange={(event) => setTitle(event.currentTarget.value)}
            placeholder={t("whatHappenedPlaceholder")}
            aria-invalid={errors.title !== undefined}
            aria-describedby={
              errors.title ? "report-incident-title-error" : undefined
            }
          />
          {errors.title ? (
            <p
              id="report-incident-title-error"
              className="text-sm text-destructive"
            >
              {errors.title}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="report-incident-description">{t("details")}</Label>
          <Textarea
            id="report-incident-description"
            value={description}
            maxLength={TEXT_MAX_LENGTH}
            onChange={(event) => setDescription(event.currentTarget.value)}
            placeholder={t("detailsPlaceholder")}
            rows={3}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="report-incident-where">{t("objects")}</Label>
          <div
            id="report-incident-where"
            tabIndex={-1}
            aria-invalid={errors.where !== undefined}
            aria-describedby={
              errors.where ? "report-incident-where-error" : undefined
            }
          >
            <CollectionMultiSelectCombobox
              organizationId={organizationId}
              selectedIds={objectIds}
              onSelectionChange={setObjectIds}
              placeholder={t("objectsPlaceholder")}
            />
          </div>
          {objectIds.length > 0 ? (
            <div className="grid gap-2 sm:max-w-xs">
              <Label htmlFor="report-incident-impact">{t("impact")}</Label>
              <Select
                value={impact}
                onValueChange={(value) => setImpact(value as IncidentImpact)}
              >
                <SelectTrigger id="report-incident-impact">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INCIDENT_IMPACTS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {tIncidents(`impacts.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {errors.where ? (
            <p
              id="report-incident-where-error"
              className="text-sm text-destructive"
            >
              {errors.where}
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="report-incident-times">{t("discoveredAt")}</Label>
            <Input
              id="report-incident-times"
              type="datetime-local"
              value={discoveredAt}
              onChange={(event) => setDiscoveredAt(event.currentTarget.value)}
              aria-invalid={errors.times !== undefined}
              aria-describedby={
                errors.times ? "report-incident-times-error" : undefined
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="report-incident-occurred">{t("occurredAt")}</Label>
            <Input
              id="report-incident-occurred"
              type="datetime-local"
              value={occurredAt}
              onChange={(event) => setOccurredAt(event.currentTarget.value)}
            />
          </div>
          {errors.times ? (
            <p
              id="report-incident-times-error"
              className="text-sm text-destructive sm:col-span-2"
            >
              {errors.times}
            </p>
          ) : null}
        </div>

        <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
          <div className="space-y-1">
            <Label htmlFor="report-incident-sensitive">{t("sensitive")}</Label>
            <p
              id="report-incident-sensitive-hint"
              className="text-sm text-muted-foreground"
            >
              {t("sensitiveHint")}
            </p>
          </div>
          <Switch
            id="report-incident-sensitive"
            checked={sensitive}
            onCheckedChange={setSensitive}
            aria-describedby="report-incident-sensitive-hint"
          />
        </div>

        {failure ? (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {tIncidents("cancel")}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {t("submit")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
