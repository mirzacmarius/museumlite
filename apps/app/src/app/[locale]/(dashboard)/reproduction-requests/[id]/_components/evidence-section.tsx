"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { REPRODUCTION_EVIDENCE_KINDS } from "@v1/backend/convex/utils/reproductionRequestValidators";
import { Badge } from "@v1/ui/badge";
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
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { useReproductionErrorMessage } from "@/hooks/use-reproduction-error-message";
import { useScopedI18n } from "@/locales/client";
import { useRequestDate } from "../../_components/request-status";
import { ReasonDialog } from "./reason-dialog";
import type { RequestView } from "./request-view";
import { Section } from "./section";

type EvidenceKind = (typeof REPRODUCTION_EVIDENCE_KINDS)[number];
const NO_DOCUMENT = "__none__";

function AddEvidenceForm({ view }: { view: RequestView }) {
  const t = useScopedI18n("reproductionRequests");
  const errorMessage = useReproductionErrorMessage();
  const addEvidence = useMutation(api.reproductionRequests.addEvidence);
  const files = useQuery(api.media.list, {
    collectionId: view.request.object._id,
  });
  const [kind, setKind] = useState<EvidenceKind>("rights_holder_permission");
  const [summary, setSummary] = useState("");
  const [documentId, setDocumentId] = useState(NO_DOCUMENT);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!summary.trim()) {
      toast.error(t("errors.summaryRequired"));
      return;
    }
    setSaving(true);
    try {
      await addEvidence({
        requestId: view.request._id,
        kind,
        summary,
        documentMediaId:
          documentId === NO_DOCUMENT
            ? undefined
            : (documentId as Id<"mediaFiles">),
      });
      setSummary("");
      setDocumentId(NO_DOCUMENT);
      toast.success(t("evidence.added"));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-lg border border-border p-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="evidence-kind">{t("evidence.kind")}</Label>
          <Select
            value={kind}
            onValueChange={(value) => {
              const next = REPRODUCTION_EVIDENCE_KINDS.find(
                (candidate) => candidate === value,
              );
              if (next) setKind(next);
            }}
          >
            <SelectTrigger id="evidence-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPRODUCTION_EVIDENCE_KINDS.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`evidenceKinds.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="evidence-document">{t("evidence.document")}</Label>
          <Select value={documentId} onValueChange={setDocumentId}>
            <SelectTrigger id="evidence-document">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_DOCUMENT}>
                {t("evidence.noDocument")}
              </SelectItem>
              {(files ?? []).map((file) => (
                <SelectItem key={file._id} value={file._id}>
                  {file.caption || file.fileName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="evidence-summary">{t("evidence.summary")}</Label>
        <Textarea
          id="evidence-summary"
          rows={2}
          maxLength={4000}
          value={summary}
          placeholder={t("evidence.summaryPlaceholder")}
          onChange={(event) => setSummary(event.target.value)}
        />
      </div>
      <Button type="submit" size="sm" disabled={saving}>
        {t("evidence.add")}
      </Button>
    </form>
  );
}

export function EvidenceSection({ view }: { view: RequestView }) {
  const t = useScopedI18n("reproductionRequests");
  const formatDate = useRequestDate();
  const errorMessage = useReproductionErrorMessage();
  const retract = useMutation(api.reproductionRequests.retractEvidence);
  const [retracting, setRetracting] = useState<Id<"reproductionEvidence">>();
  const editable = view.request.status === "open" && view.commands.canPrepare;
  const usedByDecision = new Set<string>(view.decision?.evidenceIds ?? []);

  return (
    <Section
      id="evidence-title"
      title={t("evidence.title")}
      description={t("evidence.description")}
    >
      {view.evidence.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("evidence.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {view.evidence.map((entry) => (
            <li
              key={entry._id}
              className="space-y-1 rounded-lg border border-border p-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {t(`evidenceKinds.${entry.kind}`)}
                  </Badge>
                  {usedByDecision.has(entry._id) ? (
                    <Badge variant="secondary">
                      {t("decision.evidenceBasis")}
                    </Badge>
                  ) : null}
                </div>
                {editable && !entry.retracted ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRetracting(entry._id)}
                  >
                    {t("evidence.retract")}
                  </Button>
                ) : null}
              </div>
              <p
                className={`whitespace-pre-wrap break-words ${entry.retracted ? "text-muted-foreground line-through" : ""}`}
              >
                {entry.summary}
              </p>
              {entry.document ? (
                <p className="text-xs text-muted-foreground">
                  {t("evidence.document")}: {entry.document.fileName}
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {entry.recordedByName
                  ? t("evidence.recordedBy", {
                      date: formatDate(entry.recordedAt),
                      name: entry.recordedByName,
                    })
                  : t("evidence.recordedAt", {
                      date: formatDate(entry.recordedAt),
                    })}
              </p>
              {entry.retracted ? (
                <p className="text-xs text-muted-foreground">
                  {t("evidence.retracted", {
                    date: formatDate(entry.retracted.at),
                    reason: entry.retracted.reason,
                  })}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {editable ? <AddEvidenceForm view={view} /> : null}
      {retracting ? (
        <ReasonDialog
          title={t("evidence.retractTitle")}
          description={t("evidence.retractDescription")}
          confirmLabel={t("evidence.retract")}
          onClose={() => setRetracting(undefined)}
          onConfirm={async (reason) => {
            try {
              await retract({ evidenceId: retracting, reason });
              toast.success(t("evidence.retractedToast"));
              return true;
            } catch (error) {
              toast.error(errorMessage(error));
              return false;
            }
          }}
        />
      ) : null}
    </Section>
  );
}
