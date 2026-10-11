"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { custodyConflictFromError } from "@v1/backend/convex/utils/custodyErrors";
import type {
  IncidentHandoffDirection,
  IncidentImpact,
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
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Textarea } from "@v1/ui/textarea";
import { useMutation } from "convex/react";
import { Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useReducer, useState } from "react";
import { toast } from "sonner";
import { ActionRefusal, type Refusal } from "@/components/action-refusal";
import { ClientDate } from "@/components/client-date";
import { CollectionMultiSelectCombobox } from "@/components/collection-multi-select-combobox";
import { LocationSelector } from "@/components/location-selector";
import { useCustodyConflictMessage } from "@/hooks/use-custody-conflict-message";
import { useWorkErrorMessage } from "@/hooks/use-work-error-message";
import { withReturnPath } from "@/lib/return-path";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { DATE_TIME, INCIDENT_IMPACTS } from "../../_components/incident-format";
import { type IncidentDetail, Section } from "./incident-detail-client";

type AffectedObject = IncidentDetail["objects"][number];

interface HandoffDraft {
  observedFrom: Id<"locations"> | null;
  handoffKey: string;
  destination: string;
  notes: string;
}

function updateHandoff(draft: HandoffDraft, change: Partial<HandoffDraft>) {
  return { ...draft, ...change };
}

export function IncidentObjects({ incident }: { incident: IncidentDetail }) {
  const t = useScopedI18n("incidents.objects");
  const [adding, setAdding] = useState(false);
  const [handoff, setHandoff] = useState<{
    object: AffectedObject;
    direction: IncidentHandoffDirection;
  } | null>(null);
  const open = incident.status !== "closed";

  return (
    <Section
      id="incident-objects"
      title={t("title")}
      action={
        open && incident.viewer.canWork ? (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="mr-1 size-4" aria-hidden="true" />
            {t("add")}
          </Button>
        ) : null
      }
    >
      <p className="text-sm text-muted-foreground">{t("description")}</p>
      {incident.objects.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {incident.objects.map((object) => (
            <ObjectRow
              key={object.collectionId}
              incident={incident}
              object={object}
              onHandoff={(direction) => setHandoff({ object, direction })}
            />
          ))}
        </ul>
      )}
      <Dialog open={adding} onOpenChange={setAdding}>
        {adding ? (
          <AddObjectsForm incident={incident} onDone={() => setAdding(false)} />
        ) : null}
      </Dialog>
      <Dialog
        open={handoff !== null}
        onOpenChange={(next) => {
          if (!next) setHandoff(null);
        }}
      >
        {handoff ? (
          <HandoffForm
            incident={incident}
            object={handoff.object}
            direction={handoff.direction}
            onDone={() => setHandoff(null)}
          />
        ) : null}
      </Dialog>
    </Section>
  );
}

function ObjectRow({
  incident,
  object,
  onHandoff,
}: {
  incident: IncidentDetail;
  object: AffectedObject;
  onHandoff: (direction: IncidentHandoffDirection) => void;
}) {
  const t = useScopedI18n("incidents.objects");
  const tIncidents = useScopedI18n("incidents");
  const locale = useCurrentLocale();
  const errorMessage = useWorkErrorMessage();
  const setImpact = useMutation(api.incidents.setObjectImpact);
  const open = incident.status !== "closed";
  const returnPath = `/incidents/${incident._id}`;
  const objectHref = `/objects/${object.collectionId}`;
  const evacuated = object.lastHandoff?.direction === "evacuation";

  const changeImpact = async (impact: IncidentImpact) => {
    try {
      await setImpact({
        incidentId: incident._id,
        collectionId: object.collectionId,
        impact,
        note: object.note,
      });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <li className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <Link
          href={withReturnPath(objectHref, returnPath)}
          className="break-words font-medium underline-offset-2 hover:underline"
        >
          {object.title}
        </Link>
        {object.accessionNumber ? (
          <p className="break-all font-mono text-xs text-muted-foreground">
            {object.accessionNumber}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {t("whenReported", {
            location: object.locationAtReportName ?? t("noLocation"),
          })}
          {" · "}
          {t("now", {
            location: object.currentLocationName ?? t("noLocation"),
          })}
        </p>
        {object.lastHandoff ? (
          <p className="text-xs text-muted-foreground">
            {t(`lastHandoff.${object.lastHandoff.direction}`, {
              location: object.lastHandoff.toLocationName ?? t("noLocation"),
            })}{" "}
            <ClientDate
              timestamp={object.lastHandoff.movedAt}
              locale={locale}
              options={DATE_TIME}
            />
          </p>
        ) : null}
        {object.note ? (
          <p className="whitespace-pre-wrap text-sm">{object.note}</p>
        ) : null}
        <Link
          href={withReturnPath(`${objectHref}?tab=physical`, returnPath)}
          className="inline-flex min-h-8 items-center text-xs text-primary hover:underline"
        >
          {t("recordAssessment")}
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {open && incident.viewer.canWork ? (
          <Select
            value={object.impact}
            onValueChange={(value) =>
              void changeImpact(value as IncidentImpact)
            }
          >
            <SelectTrigger
              className="w-40"
              aria-label={t("impactFor", { object: object.title })}
            >
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
        ) : (
          <span className="text-sm">
            {tIncidents(`impacts.${object.impact}`)}
          </span>
        )}
        {open && incident.viewer.canMove ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onHandoff(evacuated ? "recovery" : "evacuation")}
          >
            {evacuated ? t("recover") : t("evacuate")}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function AddObjectsForm({
  incident,
  onDone,
}: {
  incident: IncidentDetail;
  onDone: () => void;
}) {
  const t = useScopedI18n("incidents.objects");
  const tIncidents = useScopedI18n("incidents");
  const errorMessage = useWorkErrorMessage();
  const addObjects = useMutation(api.incidents.addObjects);
  const [objectIds, setObjectIds] = useState<string[]>([]);
  const [impact, setImpact] = useState<IncidentImpact>("at_risk");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (objectIds.length === 0) {
      setError(t("chooseObjects"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { added } = await addObjects({
        incidentId: incident._id,
        collectionIds: objectIds as Id<"collections">[],
        impact,
      });
      toast.success(t("added", { count: added }));
      onDone();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent>
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <DialogHeader>
          <DialogTitle>{t("addTitle")}</DialogTitle>
          <DialogDescription>{t("addDescription")}</DialogDescription>
        </DialogHeader>
        <CollectionMultiSelectCombobox
          organizationId={incident.organizationId}
          selectedIds={objectIds}
          onSelectionChange={setObjectIds}
        />
        <div className="grid gap-2">
          <Label htmlFor="incident-add-impact">{t("impact")}</Label>
          <Select
            value={impact}
            onValueChange={(value) => setImpact(value as IncidentImpact)}
          >
            <SelectTrigger id="incident-add-impact">
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
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            {tIncidents("cancel")}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {t("addSubmit")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

/**
 * Records an evacuation or recovery through the guarded movement command,
 * from the location the mover sees now. Recovery suggests the location
 * recorded when the object was linked; staff confirm it.
 */
function HandoffForm({
  incident,
  object,
  direction,
  onDone,
}: {
  incident: IncidentDetail;
  object: AffectedObject;
  direction: IncidentHandoffDirection;
  onDone: () => void;
}) {
  const t = useScopedI18n("incidents.objects");
  const tIncidents = useScopedI18n("incidents");
  const workMessage = useWorkErrorMessage();
  const custodyMessage = useCustodyConflictMessage();
  const recordHandoff = useMutation(api.incidents.recordHandoff);
  // The source the mover saw when the dialog opened, and one key per attempt.
  const [handoff, update] = useReducer(
    updateHandoff,
    null,
    (): HandoffDraft => ({
      observedFrom: object.currentLocationId ?? null,
      handoffKey: crypto.randomUUID(),
      destination:
        direction === "recovery" && object.locationAtReportId
          ? object.locationAtReportId
          : "__none__",
      notes: "",
    }),
  );
  const { observedFrom, handoffKey, destination, notes } = handoff;
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (destination === "__none__") {
      setRefusal({ message: t("chooseDestination") });
      return;
    }
    setSaving(true);
    setRefusal(null);
    try {
      await recordHandoff({
        incidentId: incident._id,
        collectionId: object.collectionId,
        direction,
        toLocationId: destination as Id<"locations">,
        expectedFromLocationId: observedFrom,
        handoffKey,
        notes: notes.trim() || undefined,
      });
      toast.success(t(`handoffRecorded.${direction}`));
      onDone();
    } catch (error) {
      setRefusal({
        message: custodyConflictFromError(error)
          ? custodyMessage(error)
          : workMessage(error),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent>
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <DialogHeader>
          <DialogTitle>
            {t(`handoffTitle.${direction}`, { object: object.title })}
          </DialogTitle>
          <DialogDescription>{t("handoffDescription")}</DialogDescription>
        </DialogHeader>
        <p className="text-sm">
          {t("from", {
            location: object.currentLocationName ?? t("noLocation"),
          })}
        </p>
        <div className="grid gap-2">
          <Label htmlFor="incident-handoff-destination">
            {t("destination")}
          </Label>
          <LocationSelector
            id="incident-handoff-destination"
            organizationId={incident.organizationId}
            value={destination}
            onValueChange={(value) => update({ destination: value })}
            allowNone={false}
          />
          {direction === "recovery" && object.locationAtReportName ? (
            <p className="text-xs text-muted-foreground">
              {t("recoverySuggestion", {
                location: object.locationAtReportName,
              })}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="incident-handoff-notes">{t("notes")}</Label>
          <Textarea
            id="incident-handoff-notes"
            value={notes}
            maxLength={4000}
            onChange={(event) => update({ notes: event.currentTarget.value })}
            rows={2}
          />
        </div>
        {refusal ? <ActionRefusal refusal={refusal} /> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            {tIncidents("cancel")}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {t(`handoffSubmit.${direction}`)}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
