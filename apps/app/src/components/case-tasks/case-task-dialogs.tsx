"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { CaseTaskCaseType } from "@v1/backend/convex/utils/caseTaskValidators";
import { Button } from "@v1/ui/button";
import { Checkbox } from "@v1/ui/checkbox";
import { DatePickerInput } from "@v1/ui/date-picker";
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
import { Textarea } from "@v1/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { useWorkErrorMessage } from "@/hooks/use-work-error-message";
import { useScopedI18n } from "@/locales/client";

const NO_REVIEWER = "none";

interface CreateTaskForm {
  title: string;
  description: string;
  ownerId: string;
  reviewerId: string;
  dueDate: string;
  dependsOn: Id<"caseTasks">[];
}

const EMPTY_CREATE_FORM: CreateTaskForm = {
  title: "",
  description: "",
  ownerId: "",
  reviewerId: NO_REVIEWER,
  dueDate: "",
  dependsOn: [],
};

interface AssignEdits {
  ownerId?: string;
  reviewerId?: string;
  dueDate?: string;
}

export interface CaseRef {
  organizationId: Id<"organizations">;
  caseType: CaseTaskCaseType;
  caseId: string;
}

/** Due dates are calendar days stored as UTC midnight. */
function dueDateValue(timestamp: number | undefined) {
  return timestamp === undefined
    ? ""
    : new Date(timestamp).toISOString().slice(0, 10);
}

function parseDueDate(value: string): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function useAssignableMembers(caseRef: CaseRef, open: boolean) {
  return useQuery(api.caseTasks.listAssignableMembers, open ? caseRef : "skip");
}

function MemberSelect({
  id,
  label,
  value,
  onChange,
  members,
  allowNone,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  members: Array<{ userId: Id<"users">; name: string }> | undefined;
  allowNone?: boolean;
}) {
  const t = useScopedI18n("caseTasks.fields");
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={t("chooseMember")} />
        </SelectTrigger>
        <SelectContent>
          {allowNone ? (
            <SelectItem value={NO_REVIEWER}>{t("noReviewer")}</SelectItem>
          ) : null}
          {(members ?? []).map((member) => (
            <SelectItem key={member.userId} value={member.userId}>
              {member.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function CreateTaskDialog({
  caseRef,
  open,
  onOpenChange,
  dependencyOptions,
}: {
  caseRef: CaseRef;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dependencyOptions: Array<{ _id: Id<"caseTasks">; title: string }>;
}) {
  const t = useScopedI18n("caseTasks");
  const errorMessage = useWorkErrorMessage();
  const members = useAssignableMembers(caseRef, open);
  const createTask = useMutation(api.caseTasks.create);
  const [form, setForm] = useState<CreateTaskForm>(EMPTY_CREATE_FORM);
  const [submitting, setSubmitting] = useState(false);
  const { title, description, ownerId, reviewerId, dueDate, dependsOn } = form;
  const update = (changes: Partial<CreateTaskForm>) =>
    setForm((current) => ({ ...current, ...changes }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const owner = members?.find((member) => member.userId === ownerId);
    const reviewer = members?.find((member) => member.userId === reviewerId);
    if (!title.trim() || !owner) {
      toast.error(t("errors.invalidInput"));
      return;
    }
    setSubmitting(true);
    try {
      await createTask({
        ...caseRef,
        title: title.trim(),
        description: description.trim() || undefined,
        ownerId: owner.userId,
        reviewerId: reviewer?.userId,
        dueDate: parseDueDate(dueDate) ?? undefined,
        dependsOnTaskIds: dependsOn.length > 0 ? dependsOn : undefined,
      });
      toast.success(t("toasts.created"));
      setForm(EMPTY_CREATE_FORM);
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("dialogs.create.title")}</DialogTitle>
            <DialogDescription>
              {t("dialogs.create.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="case-task-title">{t("fields.title")}</Label>
            <Input
              id="case-task-title"
              value={title}
              maxLength={200}
              onChange={(event) => update({ title: event.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="case-task-description">
              {t("fields.description")}
            </Label>
            <Textarea
              id="case-task-description"
              value={description}
              maxLength={2000}
              onChange={(event) => update({ description: event.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <MemberSelect
              id="case-task-owner"
              label={t("fields.owner")}
              value={ownerId}
              onChange={(value) => update({ ownerId: value })}
              members={members}
            />
            <MemberSelect
              id="case-task-reviewer"
              label={t("fields.reviewer")}
              value={reviewerId}
              onChange={(value) => update({ reviewerId: value })}
              members={members?.filter((member) => member.userId !== ownerId)}
              allowNone
            />
          </div>
          <DatePickerInput
            id="case-task-due"
            label={t("fields.dueDate")}
            value={dueDate}
            onChange={(value) => update({ dueDate: value })}
          />
          {dependencyOptions.length > 0 ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                {t("fields.dependencies")}
              </legend>
              {dependencyOptions.map((option) => {
                const checkboxId = `case-task-dependency-${option._id}`;
                return (
                  <div key={option._id} className="flex items-center gap-2">
                    <Checkbox
                      id={checkboxId}
                      checked={dependsOn.includes(option._id)}
                      onCheckedChange={(checked) =>
                        update({
                          dependsOn:
                            checked === true
                              ? [...dependsOn, option._id]
                              : dependsOn.filter((id) => id !== option._id),
                        })
                      }
                    />
                    <Label htmlFor={checkboxId} className="font-normal">
                      {option.title}
                    </Label>
                  </div>
                );
              })}
            </fieldset>
          ) : null}
          <p className="text-xs text-white/60">{t("dialogs.noAttestation")}</p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("dialogs.close")}
            </Button>
            <Button type="submit" disabled={submitting || !members}>
              {t("dialogs.create.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AssignTaskDialog({
  caseRef,
  task,
  open,
  onOpenChange,
}: {
  caseRef: CaseRef;
  task: {
    _id: Id<"caseTasks">;
    ownerId: Id<"users">;
    reviewerId?: Id<"users">;
    dueDate?: number;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useScopedI18n("caseTasks");
  const errorMessage = useWorkErrorMessage();
  const members = useAssignableMembers(caseRef, open);
  const assign = useMutation(api.caseTasks.assign);
  // Only the fields the user changed; everything else shows the task's current value.
  const [edits, setEdits] = useState<AssignEdits>({});
  const [submitting, setSubmitting] = useState(false);
  const ownerId = edits.ownerId ?? task.ownerId;
  const reviewerId = edits.reviewerId ?? task.reviewerId ?? NO_REVIEWER;
  const dueDate = edits.dueDate ?? dueDateValue(task.dueDate);
  const update = (changes: AssignEdits) =>
    setEdits((current) => ({ ...current, ...changes }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const owner = members?.find((member) => member.userId === ownerId);
    const reviewer = members?.find((member) => member.userId === reviewerId);
    if (!owner) {
      toast.error(t("errors.assigneeNotEligible"));
      return;
    }
    setSubmitting(true);
    try {
      await assign({
        taskId: task._id,
        ownerId: owner.userId,
        reviewerId: reviewer?.userId ?? null,
        dueDate: parseDueDate(dueDate),
      });
      toast.success(t("toasts.updated"));
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("dialogs.assign.title")}</DialogTitle>
            <DialogDescription>
              {t("dialogs.assign.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <MemberSelect
              id={`case-task-owner-${task._id}`}
              label={t("fields.owner")}
              value={ownerId}
              onChange={(value) => update({ ownerId: value })}
              members={members}
            />
            <MemberSelect
              id={`case-task-reviewer-${task._id}`}
              label={t("fields.reviewer")}
              value={reviewerId}
              onChange={(value) => update({ reviewerId: value })}
              members={members?.filter((member) => member.userId !== ownerId)}
              allowNone
            />
          </div>
          <DatePickerInput
            id={`case-task-due-${task._id}`}
            label={t("fields.dueDate")}
            value={dueDate}
            onChange={(value) => update({ dueDate: value })}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("dialogs.close")}
            </Button>
            <Button type="submit" disabled={submitting || !members}>
              {t("dialogs.assign.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** One note-taking dialog for block, cancel, return, complete, send and approve. */
export function TaskNoteDialog({
  open,
  onOpenChange,
  title,
  description,
  noteLabel,
  submitLabel,
  noteRequired,
  showNoAttestation,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  noteLabel: string;
  submitLabel: string;
  noteRequired: boolean;
  showNoAttestation: boolean;
  onSubmit: (note: string | undefined) => Promise<unknown>;
}) {
  const t = useScopedI18n("caseTasks");
  const errorMessage = useWorkErrorMessage();
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = note.trim();
    if (noteRequired && !trimmed) {
      toast.error(t("errors.invalidInput"));
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(trimmed || undefined);
      toast.success(t("toasts.updated"));
      setNote("");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="case-task-note">{noteLabel}</Label>
            <Textarea
              id="case-task-note"
              value={note}
              maxLength={2000}
              required={noteRequired}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          {showNoAttestation ? (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              {t("dialogs.noAttestation")}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("dialogs.close")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LinkEvidenceDialog({
  caseRef,
  taskId,
  linked,
  open,
  onOpenChange,
}: {
  caseRef: CaseRef;
  taskId: Id<"caseTasks">;
  linked: Set<string>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useScopedI18n("caseTasks");
  const errorMessage = useWorkErrorMessage();
  const candidates = useQuery(
    api.caseTasks.listEvidenceCandidates,
    open ? caseRef : "skip",
  );
  const linkEvidence = useMutation(api.caseTasks.linkEvidence);
  const [selected, setSelected] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const available = (candidates ?? []).filter(
    (candidate) => !linked.has(candidate.reference.id),
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const candidate = available.find(
      (option) => option.reference.id === selected,
    );
    if (!candidate) {
      toast.error(t("errors.evidenceNotFound"));
      return;
    }
    setSubmitting(true);
    try {
      await linkEvidence({ taskId, reference: candidate.reference });
      toast.success(t("toasts.evidenceLinked"));
      setSelected("");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("dialogs.evidence.title")}</DialogTitle>
            <DialogDescription>
              {t("dialogs.evidence.description")}
            </DialogDescription>
          </DialogHeader>
          {candidates !== undefined && available.length === 0 ? (
            <p className="text-sm text-white/60">
              {t("dialogs.evidence.empty")}
            </p>
          ) : (
            <div className="space-y-2">
              <Label htmlFor={`case-task-evidence-${taskId}`}>
                {t("fields.evidence")}
              </Label>
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger id={`case-task-evidence-${taskId}`}>
                  <SelectValue placeholder={t("dialogs.evidence.choose")} />
                </SelectTrigger>
                <SelectContent>
                  {available.map((candidate) => (
                    <SelectItem
                      key={candidate.reference.id}
                      value={candidate.reference.id}
                    >
                      {t(`evidenceKinds.${candidate.reference.kind}`)}:{" "}
                      {candidate.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("dialogs.close")}
            </Button>
            <Button
              type="submit"
              disabled={submitting || available.length === 0}
            >
              {t("dialogs.evidence.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
