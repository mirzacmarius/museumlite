"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { toast } from "sonner";
import { useWorkErrorMessage } from "@/hooks/use-work-error-message";
import { useScopedI18n } from "@/locales/client";
import {
  AssignTaskDialog,
  LinkEvidenceDialog,
  TaskNoteDialog,
} from "./case-task-dialogs";

export type CaseTask = FunctionReturnType<
  typeof api.caseTasks.listForCase
>["tasks"][number];

type NoteAction =
  | "block"
  | "cancel"
  | "return"
  | "complete"
  | "submit"
  | "approve";

interface NoteDialogConfig {
  title: string;
  description: string;
  noteLabel: string;
  submitLabel: string;
  noteRequired: boolean;
  showNoAttestation: boolean;
  onSubmit: (note: string | undefined) => Promise<unknown>;
}

function useNoteDialogs(taskId: Id<"caseTasks">, suggested: boolean) {
  const t = useScopedI18n("caseTasks");
  const block = useMutation(api.caseTasks.block);
  const cancel = useMutation(api.caseTasks.cancel);
  const returnForChanges = useMutation(api.caseTasks.returnForChanges);
  const complete = useMutation(api.caseTasks.complete);
  const submitForReview = useMutation(api.caseTasks.submitForReview);
  const approve = useMutation(api.caseTasks.approve);
  const dialogs: Record<NoteAction, NoteDialogConfig> = {
    block: {
      title: t("dialogs.block.title"),
      description: t("dialogs.block.description"),
      noteLabel: t("fields.reason"),
      submitLabel: t("dialogs.block.submit"),
      noteRequired: true,
      showNoAttestation: false,
      onSubmit: (note) => block({ taskId, reason: note ?? "" }),
    },
    cancel: {
      title: suggested ? t("suggestion.dismiss") : t("dialogs.cancel.title"),
      description: suggested
        ? t("suggestion.dismissDescription")
        : t("dialogs.cancel.description"),
      noteLabel: t("fields.reason"),
      submitLabel: suggested
        ? t("suggestion.dismiss")
        : t("dialogs.cancel.submit"),
      noteRequired: true,
      showNoAttestation: false,
      onSubmit: (note) => cancel({ taskId, reason: note ?? "" }),
    },
    return: {
      title: t("dialogs.returnForChanges.title"),
      description: t("dialogs.returnForChanges.description"),
      noteLabel: t("fields.note"),
      submitLabel: t("dialogs.returnForChanges.submit"),
      noteRequired: true,
      showNoAttestation: false,
      onSubmit: (note) => returnForChanges({ taskId, note: note ?? "" }),
    },
    complete: {
      title: t("dialogs.complete.title"),
      description: t("dialogs.complete.description"),
      noteLabel: t("fields.note"),
      submitLabel: t("dialogs.complete.submit"),
      noteRequired: false,
      showNoAttestation: true,
      onSubmit: (note) => complete({ taskId, note }),
    },
    submit: {
      title: t("dialogs.submitForReview.title"),
      description: t("dialogs.submitForReview.description"),
      noteLabel: t("fields.note"),
      submitLabel: t("dialogs.submitForReview.submit"),
      noteRequired: false,
      showNoAttestation: true,
      onSubmit: (note) => submitForReview({ taskId, note }),
    },
    approve: {
      title: t("dialogs.approve.title"),
      description: t("dialogs.approve.description"),
      noteLabel: t("fields.note"),
      submitLabel: t("dialogs.approve.submit"),
      noteRequired: false,
      showNoAttestation: true,
      onSubmit: (note) => approve({ taskId, note }),
    },
  };
  return dialogs;
}

/** Status-appropriate actions for one open task the viewer may work on. */
export function CaseTaskActions({
  task,
  organizationId,
}: {
  task: CaseTask;
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("caseTasks");
  const errorMessage = useWorkErrorMessage();
  const start = useMutation(api.caseTasks.start);
  const unblock = useMutation(api.caseTasks.unblock);
  const noteDialogs = useNoteDialogs(task._id, task.suggestion !== undefined);
  const [noteAction, setNoteAction] = useState<NoteAction | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const caseRef = {
    organizationId,
    caseType: task.caseType,
    caseId: task.caseId,
  };
  const waiting = task.openDependencyCount > 0;
  const evidenceMissing = task.requiredEvidence?.linked === false;
  const workable = task.status === "todo" || task.status === "in_progress";
  const activeNoteDialog = noteAction ? noteDialogs[noteAction] : null;

  const runNow = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      toast.success(t("toasts.updated"));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {task.status === "todo" ? (
        <Button
          size="sm"
          disabled={busy || waiting}
          onClick={() => runNow(() => start({ taskId: task._id }))}
        >
          {t("actions.start")}
        </Button>
      ) : null}
      {task.status === "blocked" ? (
        <Button
          size="sm"
          disabled={busy}
          onClick={() => runNow(() => unblock({ taskId: task._id }))}
        >
          {t("actions.unblock")}
        </Button>
      ) : null}
      {workable ? (
        <Button
          size="sm"
          variant="outline"
          disabled={busy || waiting || evidenceMissing}
          onClick={() => setNoteAction(task.reviewerId ? "submit" : "complete")}
        >
          {task.reviewerId
            ? t("actions.submitForReview")
            : t("actions.complete")}
        </Button>
      ) : null}
      {task.status === "in_review" && task.viewerIsReviewer ? (
        <>
          <Button
            size="sm"
            disabled={busy}
            onClick={() => setNoteAction("approve")}
          >
            {t("actions.approve")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => setNoteAction("return")}
          >
            {t("actions.returnForChanges")}
          </Button>
        </>
      ) : null}
      {workable ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => setNoteAction("block")}
        >
          {t("actions.block")}
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="ghost"
        disabled={busy}
        onClick={() => setAssignOpen(true)}
      >
        {t("actions.assign")}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={busy}
        onClick={() => setEvidenceOpen(true)}
      >
        {t("actions.linkEvidence")}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={busy}
        onClick={() => setNoteAction("cancel")}
      >
        {task.suggestion ? t("suggestion.dismiss") : t("actions.cancel")}
      </Button>

      {activeNoteDialog ? (
        <TaskNoteDialog
          open
          onOpenChange={(open) => {
            if (!open) setNoteAction(null);
          }}
          {...activeNoteDialog}
        />
      ) : null}
      {assignOpen ? (
        <AssignTaskDialog
          caseRef={caseRef}
          task={task}
          open={assignOpen}
          onOpenChange={setAssignOpen}
        />
      ) : null}
      {evidenceOpen ? (
        <LinkEvidenceDialog
          caseRef={caseRef}
          taskId={task._id}
          linked={new Set(task.evidence.map((evidence) => evidence.recordId))}
          open={evidenceOpen}
          onOpenChange={setEvidenceOpen}
        />
      ) : null}
    </div>
  );
}
