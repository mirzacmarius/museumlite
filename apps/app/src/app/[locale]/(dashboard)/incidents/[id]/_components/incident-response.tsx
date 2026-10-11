"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { IncidentSeverity } from "@v1/backend/convex/utils/incidentValidators";
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
import { Label } from "@v1/ui/label";
import { RadioGroup, RadioGroupItem } from "@v1/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Switch } from "@v1/ui/switch";
import { Textarea } from "@v1/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { ClientDate } from "@/components/client-date";
import { useWorkErrorMessage } from "@/hooks/use-work-error-message";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import {
  DATE_TIME,
  INCIDENT_SEVERITIES,
} from "../../_components/incident-format";
import { Field, type IncidentDetail, Section } from "./incident-detail-client";

/** Severity, lead, responders and the plans a coordinator chose. */
export function IncidentResponse({ incident }: { incident: IncidentDetail }) {
  const t = useScopedI18n("incidents.response");
  const tIncidents = useScopedI18n("incidents");
  const locale = useCurrentLocale();
  const [open, setOpen] = useState(false);
  const canTriage =
    incident.viewer.canCoordinate && incident.status !== "closed";
  const triaged = incident.plans !== null;

  return (
    <Section
      id="incident-response"
      title={t("title")}
      action={
        canTriage ? (
          <Button size="sm" onClick={() => setOpen(true)}>
            {triaged ? t("update") : t("triage")}
          </Button>
        ) : null
      }
    >
      {!triaged ? (
        <p className="text-sm text-muted-foreground">
          {incident.viewer.canCoordinate
            ? t("awaitingTriageCoordinator")
            : t("awaitingTriage")}
        </p>
      ) : (
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label={t("severity")}>
            {incident.severity
              ? tIncidents(`severities.${incident.severity}`)
              : tIncidents("notTriaged")}
          </Field>
          <Field label={t("lead")}>
            {incident.lead?.name ?? tIncidents("notRecorded")}
          </Field>
          <Field label={t("responders")}>
            {incident.responders.length === 0
              ? t("noResponders")
              : incident.responders
                  .map((person) => person.name ?? tIncidents("formerMember"))
                  .join(", ")}
          </Field>
          <Field label={t("triaged")}>
            {incident.triagedByName ?? tIncidents("notRecorded")}
            {incident.triagedAt ? (
              <>
                {" · "}
                <ClientDate
                  timestamp={incident.triagedAt}
                  locale={locale}
                  options={DATE_TIME}
                />
              </>
            ) : null}
          </Field>
          <div className="sm:col-span-2">
            <Field label={t("plans")}>
              {incident.plans?.length
                ? incident.plans.map((plan) => plan.name).join(", ")
                : t("noPlan")}
            </Field>
          </div>
          {incident.triageNote ? (
            <div className="sm:col-span-2">
              <Field label={t("note")}>{incident.triageNote}</Field>
            </div>
          ) : null}
        </dl>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        {open ? (
          <TriageForm incident={incident} onDone={() => setOpen(false)} />
        ) : null}
      </Dialog>
    </Section>
  );
}

function TriageForm({
  incident,
  onDone,
}: {
  incident: IncidentDetail;
  onDone: () => void;
}) {
  const t = useScopedI18n("incidents.response");
  const tIncidents = useScopedI18n("incidents");
  const errorMessage = useWorkErrorMessage();
  const triage = useMutation(api.incidents.triage);
  const plans = useQuery(api.incidents.listPlanOptions, {
    organizationId: incident.organizationId,
  });
  const candidates = useQuery(api.incidents.listTeamCandidates, {
    incidentId: incident._id,
  });
  const chosenBefore = new Set(incident.plans?.map((plan) => plan.recipeId));
  const [severity, setSeverity] = useState<IncidentSeverity | "">(
    incident.severity ?? "",
  );
  const [leadId, setLeadId] = useState<string>(incident.lead?.userId ?? "");
  const [responderIds, setResponderIds] = useState<Set<string>>(
    () => new Set(incident.responders.map((person) => person.userId)),
  );
  const [sensitive, setSensitive] = useState(incident.sensitive);
  // First triage records a deliberate choice; later updates only add plans.
  const [planChoice, setPlanChoice] = useState<"" | "plans" | "none">(
    incident.plans === null ? "" : "none",
  );
  const [planIds, setPlanIds] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const togglePlan = (recipeId: string, checked: boolean) => {
    setPlanIds((current) => {
      const next = new Set(current);
      if (checked) next.add(recipeId);
      else next.delete(recipeId);
      return next;
    });
    if (checked) setPlanChoice("plans");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!severity || !leadId) {
      setError(t("errors.severityAndLead"));
      return;
    }
    if (planChoice === "" || (planChoice === "plans" && planIds.size === 0)) {
      setError(t("errors.planChoice"));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const outcome = await triage({
        incidentId: incident._id,
        severity,
        leadId: leadId as Id<"users">,
        responderIds: [...responderIds].filter(
          (id) => id !== leadId,
        ) as Id<"users">[],
        sensitive,
        plan:
          planChoice === "plans"
            ? {
                kind: "plans",
                recipeIds: [...planIds] as Id<"preparationRecipes">[],
              }
            : { kind: "none" },
        note: note.trim() || undefined,
      });
      if (outcome.suggested > 0)
        toast.success(t("tasksSuggested", { count: outcome.suggested }));
      else toast.success(t("saved"));
      if (outcome.skipped.length > 0)
        toast.warning(t("stepsSkipped", { count: outcome.skipped.length }));
      onDone();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const newPlans = plans?.filter((plan) => !chosenBefore.has(plan.recipeId));

  return (
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <DialogHeader>
          <DialogTitle>
            {incident.plans === null ? t("triageTitle") : t("updateTitle")}
          </DialogTitle>
          <DialogDescription>{t("triageDescription")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="triage-severity">{t("severity")}</Label>
            <Select
              value={severity}
              onValueChange={(value) => setSeverity(value as IncidentSeverity)}
            >
              <SelectTrigger id="triage-severity">
                <SelectValue placeholder={t("chooseSeverity")} />
              </SelectTrigger>
              <SelectContent>
                {INCIDENT_SEVERITIES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {tIncidents(`severities.${option}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="triage-lead">{t("lead")}</Label>
            <Select value={leadId} onValueChange={setLeadId}>
              <SelectTrigger id="triage-lead" disabled={!candidates}>
                <SelectValue placeholder={t("chooseLead")} />
              </SelectTrigger>
              <SelectContent>
                {candidates
                  ?.filter((candidate) => candidate.canLead)
                  .map((candidate) => (
                    <SelectItem key={candidate.userId} value={candidate.userId}>
                      {candidate.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t("responders")}</legend>
          <p className="text-sm text-muted-foreground">{t("respondersHint")}</p>
          <div className="grid max-h-48 gap-2 overflow-y-auto rounded-lg border border-border p-3 sm:grid-cols-2">
            {candidates === undefined ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : (
              candidates
                .filter((candidate) => candidate.userId !== leadId)
                .map((candidate) => (
                  <div
                    key={candidate.userId}
                    className="flex items-center gap-2"
                  >
                    <Checkbox
                      id={`triage-responder-${candidate.userId}`}
                      checked={responderIds.has(candidate.userId)}
                      onCheckedChange={(checked) =>
                        setResponderIds((current) => {
                          const next = new Set(current);
                          if (checked === true) next.add(candidate.userId);
                          else next.delete(candidate.userId);
                          return next;
                        })
                      }
                    />
                    <Label
                      htmlFor={`triage-responder-${candidate.userId}`}
                      className="font-normal"
                    >
                      {candidate.name}
                    </Label>
                  </div>
                ))
            )}
          </div>
        </fieldset>

        <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
          <div className="space-y-1">
            <Label htmlFor="triage-sensitive">{tIncidents("sensitive")}</Label>
            <p
              id="triage-sensitive-hint"
              className="text-sm text-muted-foreground"
            >
              {tIncidents("sensitiveHint")}
            </p>
          </div>
          <Switch
            id="triage-sensitive"
            checked={sensitive}
            onCheckedChange={setSensitive}
            aria-describedby="triage-sensitive-hint"
          />
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">{t("plans")}</legend>
          <p className="text-sm text-muted-foreground">{t("plansHint")}</p>
          {incident.plans?.length ? (
            <p className="text-sm">
              {t("plansChosen", {
                plans: incident.plans.map((plan) => plan.name).join(", "),
              })}
            </p>
          ) : null}
          <RadioGroup
            value={planChoice}
            onValueChange={(value) => setPlanChoice(value as "plans" | "none")}
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="none" id="triage-plan-none" />
              <Label htmlFor="triage-plan-none" className="font-normal">
                {incident.plans === null
                  ? t("noPlanApplies")
                  : t("noMorePlans")}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem
                value="plans"
                id="triage-plan-some"
                disabled={!newPlans?.length}
              />
              <Label htmlFor="triage-plan-some" className="font-normal">
                {t("followPlans")}
              </Label>
            </div>
          </RadioGroup>
          {newPlans === undefined ? null : newPlans.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("noPlansAvailable")}
            </p>
          ) : (
            <ul className="space-y-2">
              {newPlans.map((plan) => (
                <li
                  key={plan.recipeId}
                  className="rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`triage-plan-${plan.recipeId}`}
                      checked={planIds.has(plan.recipeId)}
                      onCheckedChange={(checked) =>
                        togglePlan(plan.recipeId, checked === true)
                      }
                    />
                    <Label
                      htmlFor={`triage-plan-${plan.recipeId}`}
                      className="font-medium"
                    >
                      {plan.name}
                    </Label>
                  </div>
                  <ol className="mt-2 list-decimal space-y-1 pl-10 text-sm text-muted-foreground">
                    {plan.steps.map((step) => (
                      <li key={step.key}>
                        {step.title}
                        {step.offsetHours !== undefined
                          ? ` · ${t("dueWithin", { hours: step.offsetHours })}`
                          : null}
                      </li>
                    ))}
                  </ol>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <div className="grid gap-2">
          <Label htmlFor="triage-note">{t("note")}</Label>
          <Textarea
            id="triage-note"
            value={note}
            maxLength={4000}
            onChange={(event) => setNote(event.currentTarget.value)}
            rows={3}
          />
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
            {t("save")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
