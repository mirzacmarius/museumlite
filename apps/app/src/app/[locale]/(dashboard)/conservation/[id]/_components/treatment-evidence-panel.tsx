"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Textarea } from "@v1/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle2, ClipboardList, Loader2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ClientDate } from "@/components/client-date";
import { PermissionGate } from "@/components/permission-gate";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

interface TreatmentEvidencePanelProps {
  treatmentId: Id<"conservationTreatments">;
  collectionId: Id<"collections">;
  status?: string;
}

export function TreatmentEvidencePanel({
  treatmentId,
  collectionId,
  status,
}: TreatmentEvidencePanelProps) {
  const locale = useCurrentLocale();
  const t = useScopedI18n("conservation");
  const evidence = useQuery(api.conservationTreatments.getTreatmentEvidence, {
    treatmentId,
  });
  const assessments = useQuery(api.conditionAssessments.listForObject, {
    collectionId,
    paginationOpts: { numItems: 25, cursor: null },
  });

  const linkBaseline = useMutation(
    api.conservationTreatments.linkBaselineAssessment,
  );
  const linkOutcome = useMutation(
    api.conservationTreatments.linkOutcomeAssessment,
  );
  const approve = useMutation(api.conservationTreatments.approve);
  const startProgress = useMutation(api.conservationTreatments.startProgress);
  const complete = useMutation(api.conservationTreatments.complete);
  const setFollowUp = useMutation(api.conservationTreatments.setFollowUp);

  const [selectedBaseline, setSelectedBaseline] = useState("");
  const [selectedOutcome, setSelectedOutcome] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const assessmentOptions = useMemo(
    () => assessments?.page ?? [],
    [assessments?.page],
  );

  if (evidence === undefined) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {t("evidence.loading")}
      </div>
    );
  }

  const isClosed =
    status === "completed" ||
    status === "rejected" ||
    evidence.status === "completed";

  const runAction = async (key: string, action: () => Promise<unknown>) => {
    try {
      setBusyAction(key);
      await action();
      toast.success(t("evidence.actionSuccess"));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("evidence.actionError");
      toast.error(message);
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/10 bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="size-4 text-white/60" />
          <h3 className="text-lg font-medium text-foreground">
            {t("evidence.title")}
          </h3>
        </div>
        <p className="text-sm text-white/60">{t("evidence.description")}</p>

        <div className="grid gap-4 md:grid-cols-2">
          <AssessmentCard
            label={t("evidence.baseline")}
            assessment={evidence.baseline}
            emptyLabel={t("evidence.notLinked")}
            locale={locale}
          />
          <AssessmentCard
            label={t("evidence.outcome")}
            assessment={evidence.outcome}
            emptyLabel={t("evidence.notLinked")}
            locale={locale}
          />
        </div>

        {evidence.baseline && evidence.outcome && (
          <div className="rounded-lg border border-white/10 bg-black/40 p-4 text-sm">
            <p className="mb-2 font-medium text-foreground">
              {t("evidence.comparison")}
            </p>
            <div className="flex flex-wrap gap-4 text-white/80">
              <span>
                {t("evidence.before")}:{" "}
                <strong>{evidence.comparison.baselineCondition}</strong>
              </span>
              <span>
                {t("evidence.after")}:{" "}
                <strong>{evidence.comparison.outcomeCondition}</strong>
              </span>
            </div>
          </div>
        )}

        <p className="text-xs text-white/60">
          {t("evidence.attachmentCount", {
            count: String(evidence.attachmentCount),
          })}
        </p>
      </div>

      {!isClosed && (
        <PermissionGate permission="collections.update">
          <div className="rounded-xl border border-white/10 bg-card p-6 space-y-4">
            <h4 className="text-sm font-medium uppercase tracking-wider text-white/60">
              {t("evidence.linkAssessments")}
            </h4>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("evidence.baseline")}</Label>
                <Select
                  value={selectedBaseline}
                  onValueChange={setSelectedBaseline}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("evidence.selectAssessment")} />
                  </SelectTrigger>
                  <SelectContent>
                    {assessmentOptions.map((item) => (
                      <SelectItem key={item._id} value={item._id}>
                        {item.condition}: {item.summary} ({item.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!selectedBaseline || busyAction !== null}
                  onClick={() =>
                    runAction("baseline", () =>
                      linkBaseline({
                        treatmentId,
                        assessmentId:
                          selectedBaseline as Id<"conditionAssessments">,
                      }),
                    )
                  }
                >
                  {t("evidence.linkBaseline")}
                </Button>
              </div>
              <div className="space-y-2">
                <Label>{t("evidence.outcome")}</Label>
                <Select
                  value={selectedOutcome}
                  onValueChange={setSelectedOutcome}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("evidence.selectAssessment")} />
                  </SelectTrigger>
                  <SelectContent>
                    {assessmentOptions.map((item) => (
                      <SelectItem key={item._id} value={item._id}>
                        {item.condition}: {item.summary} ({item.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!selectedOutcome || busyAction !== null}
                  onClick={() =>
                    runAction("outcome", () =>
                      linkOutcome({
                        treatmentId,
                        assessmentId:
                          selectedOutcome as Id<"conditionAssessments">,
                      }),
                    )
                  }
                >
                  {t("evidence.linkOutcome")}
                </Button>
              </div>
            </div>
            <Link
              href={`/objects/${collectionId}`}
              className="text-sm text-blue-400 hover:text-blue-300 hover:underline"
            >
              {t("evidence.captureOnObject")}
            </Link>
          </div>
        </PermissionGate>
      )}

      <div className="rounded-xl border border-white/10 bg-card p-6 space-y-3">
        <h4 className="text-sm font-medium uppercase tracking-wider text-white/60">
          {t("evidence.workflow")}
        </h4>
        <div className="flex flex-wrap gap-2">
          <PermissionGate permission="collections.approve_conservation">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={status !== "proposed" || busyAction !== null}
              onClick={() =>
                runAction("approve", () => approve({ treatmentId }))
              }
            >
              {t("evidence.approve")}
            </Button>
          </PermissionGate>
          <PermissionGate permission="collections.update">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={
                (status !== "approved" && status !== "in_progress") ||
                busyAction !== null
              }
              onClick={() =>
                runAction("start", () => startProgress({ treatmentId }))
              }
            >
              {t("evidence.start")}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={
                (status !== "approved" && status !== "in_progress") ||
                busyAction !== null
              }
              onClick={() =>
                runAction("complete", () => complete({ treatmentId }))
              }
            >
              {t("evidence.complete")}
            </Button>
          </PermissionGate>
        </div>
      </div>

      {evidence.status === "completed" && (
        <PermissionGate permission="collections.update">
          <div className="rounded-xl border border-white/10 bg-card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-green-400" />
              <h4 className="text-sm font-medium text-foreground">
                {t("evidence.followUpTitle")}
              </h4>
            </div>
            <p className="text-sm text-white/60">
              {t("evidence.followUpStatus")}:{" "}
              <span className="text-foreground">
                {t(`evidence.followUp.${evidence.followUp.status}`)}
              </span>
            </p>
            {evidence.followUp.notes && (
              <p className="text-sm text-white/80">{evidence.followUp.notes}</p>
            )}
            {evidence.followUp.dueAt && (
              <p className="text-xs text-white/60">
                {t("evidence.followUpDue")}{" "}
                <ClientDate
                  timestamp={evidence.followUp.dueAt}
                  locale={locale}
                />
              </p>
            )}
            <Textarea
              value={followUpNotes}
              onChange={(event) => setFollowUpNotes(event.target.value)}
              placeholder={t("evidence.followUpNotesPlaceholder")}
              rows={3}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busyAction !== null}
                onClick={() =>
                  runAction("followUpPending", () =>
                    setFollowUp({
                      treatmentId,
                      status: "pending",
                      notes: followUpNotes || undefined,
                    }),
                  )
                }
              >
                {t("evidence.scheduleFollowUp")}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={busyAction !== null}
                onClick={() =>
                  runAction("followUpDone", () =>
                    setFollowUp({
                      treatmentId,
                      status: "completed",
                      notes: followUpNotes || undefined,
                    }),
                  )
                }
              >
                {t("evidence.markFollowUpDone")}
              </Button>
            </div>
          </div>
        </PermissionGate>
      )}
    </div>
  );
}

function AssessmentCard({
  label,
  assessment,
  emptyLabel,
  locale,
}: {
  label: string;
  assessment: {
    condition: string;
    summary: string;
    assessedAt: number;
    status: "draft" | "accepted";
  } | null;
  emptyLabel: string;
  locale: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-4">
      <p className="text-xs uppercase tracking-wider text-white/60">{label}</p>
      {assessment ? (
        <div className="mt-2 space-y-1 text-sm">
          <p className="font-medium text-foreground">{assessment.condition}</p>
          <p className="text-white/70">{assessment.summary}</p>
          <p className="text-xs text-white/60">
            <ClientDate timestamp={assessment.assessedAt} locale={locale} /> ·{" "}
            {assessment.status}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-white/60">{emptyLabel}</p>
      )}
    </div>
  );
}
