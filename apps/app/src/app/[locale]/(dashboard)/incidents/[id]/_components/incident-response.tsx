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
import type { FunctionReturnType } from "convex/server";
import { Loader2 } from "lucide-react";
import { type FormEvent, useReducer, useState } from "react";
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

type Candidate = { userId: Id<"users">; name: string; canLead: boolean };
type PlanOption = FunctionReturnType<
  typeof api.incidents.listPlanOptions
>[number];

interface TriageDraft {
  severity: IncidentSeverity | "";
  leadId: string;
  responderIds: ReadonlySet<string>;
  sensitive: boolean;
  /** First triage records a deliberate choice; later updates only add plans. */
  planChoice: "" | "plans" | "none";
  planIds: ReadonlySet<string>;
  note: string;
}

function updateTriage(draft: TriageDraft, change: Partial<TriageDraft>) {
  return { ...draft, ...change };
}

function toggled(set: ReadonlySet<string>, id: string, on: boolean) {
  const next = new Set(set);
  if (on) next.add(id);
  else next.delete(id);
  return next;
}

function triageDraftOf(incident: IncidentDetail): TriageDraft {
  return {
    severity: incident.severity ?? "",
    leadId: incident.lead?.userId ?? "",
    responderIds: new Set(incident.responders.map((person) => person.userId)),
    sensitive: incident.sensitive,
    planChoice: incident.plans === null ? "" : "none",
    planIds: new Set(),
    note: "",
  };
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
  const [draft, update] = useReducer(updateTriage, incident, triageDraftOf);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const change = (next: Partial<TriageDraft>) => {
    setError(null);
    update(next);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { severity, leadId, planChoice, planIds } = draft;
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
        responderIds: [...draft.responderIds].filter(
          (id) => id !== leadId,
        ) as Id<"users">[],
        sensitive: draft.sensitive,
        plan:
          planChoice === "plans"
            ? {
                kind: "plans",
                recipeIds: [...planIds] as Id<"preparationRecipes">[],
              }
            : { kind: "none" },
        note: draft.note.trim() || undefined,
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

  const leads = candidates?.flatMap((candidate) =>
    candidate.canLead ? [candidate] : [],
  );

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
              value={draft.severity}
              onValueChange={(value) =>
                change({ severity: value as IncidentSeverity })
              }
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
            <Select
              value={draft.leadId}
              onValueChange={(value) => change({ leadId: value })}
            >
              <SelectTrigger id="triage-lead" disabled={!leads}>
                <SelectValue placeholder={t("chooseLead")} />
              </SelectTrigger>
              <SelectContent>
                {leads?.map((candidate) => (
                  <SelectItem key={candidate.userId} value={candidate.userId}>
                    {candidate.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <ResponderPicker
          candidates={candidates}
          leadId={draft.leadId}
          selected={draft.responderIds}
          onToggle={(userId, on) =>
            change({ responderIds: toggled(draft.responderIds, userId, on) })
          }
        />

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
            checked={draft.sensitive}
            onCheckedChange={(checked) => change({ sensitive: checked })}
            aria-describedby="triage-sensitive-hint"
          />
        </div>

        <PlanPicker
          incident={incident}
          plans={plans}
          choice={draft.planChoice}
          selected={draft.planIds}
          onChoice={(planChoice) => change({ planChoice })}
          onToggle={(recipeId, on) =>
            change({
              planIds: toggled(draft.planIds, recipeId, on),
              ...(on ? { planChoice: "plans" as const } : {}),
            })
          }
        />

        <div className="grid gap-2">
          <Label htmlFor="triage-note">{t("note")}</Label>
          <Textarea
            id="triage-note"
            value={draft.note}
            maxLength={4000}
            onChange={(event) => update({ note: event.currentTarget.value })}
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

function ResponderPicker({
  candidates,
  leadId,
  selected,
  onToggle,
}: {
  candidates: Candidate[] | undefined;
  leadId: string;
  selected: ReadonlySet<string>;
  onToggle: (userId: string, on: boolean) => void;
}) {
  const t = useScopedI18n("incidents.response");
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{t("responders")}</legend>
      <p className="text-sm text-muted-foreground">{t("respondersHint")}</p>
      <div className="grid max-h-48 gap-2 overflow-y-auto rounded-lg border border-border p-3 sm:grid-cols-2">
        {candidates === undefined ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : (
          candidates.flatMap((candidate) =>
            candidate.userId === leadId
              ? []
              : [
                  <div
                    key={candidate.userId}
                    className="flex items-center gap-2"
                  >
                    <Checkbox
                      id={`triage-responder-${candidate.userId}`}
                      checked={selected.has(candidate.userId)}
                      onCheckedChange={(checked) =>
                        onToggle(candidate.userId, checked === true)
                      }
                    />
                    <Label
                      htmlFor={`triage-responder-${candidate.userId}`}
                      className="font-normal"
                    >
                      {candidate.name}
                    </Label>
                  </div>,
                ],
          )
        )}
      </div>
    </fieldset>
  );
}

/** Active plans not chosen yet, or the explicit record that none applies. */
function PlanPicker({
  incident,
  plans,
  choice,
  selected,
  onChoice,
  onToggle,
}: {
  incident: IncidentDetail;
  plans: PlanOption[] | undefined;
  choice: TriageDraft["planChoice"];
  selected: ReadonlySet<string>;
  onChoice: (choice: "plans" | "none") => void;
  onToggle: (recipeId: string, on: boolean) => void;
}) {
  const t = useScopedI18n("incidents.response");
  const chosenBefore = new Set(incident.plans?.map((plan) => plan.recipeId));
  const newPlans = plans?.filter((plan) => !chosenBefore.has(plan.recipeId));
  return (
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
        value={choice}
        onValueChange={(value) => onChoice(value as "plans" | "none")}
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="none" id="triage-plan-none" />
          <Label htmlFor="triage-plan-none" className="font-normal">
            {incident.plans === null ? t("noPlanApplies") : t("noMorePlans")}
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
        <p className="text-sm text-muted-foreground">{t("noPlansAvailable")}</p>
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
                  checked={selected.has(plan.recipeId)}
                  onCheckedChange={(checked) =>
                    onToggle(plan.recipeId, checked === true)
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
  );
}
