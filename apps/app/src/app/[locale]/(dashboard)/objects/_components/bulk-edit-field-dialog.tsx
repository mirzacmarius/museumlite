"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  BULK_EDIT_FIELDS,
  BULK_EDIT_MAX_SELECTION,
  BULK_EDIT_VALUE_LIMIT,
  type BulkEdit,
  type BulkEditField,
} from "@v1/backend/convex/utils/bulkFieldEdits";
import type { CatalogFilters } from "@v1/backend/convex/utils/catalogFilterValidators";
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
import { RadioGroup, RadioGroupItem } from "@v1/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { AlertTriangle } from "lucide-react";
import {
  type RefObject,
  useDeferredValue,
  useId,
  useReducer,
  useState,
} from "react";
import { ActionRefusal, type Refusal } from "@/components/action-refusal";
import {
  useBulkEditCodeMessage,
  useBulkEditErrorMessage,
} from "@/hooks/use-bulk-edit-error-message";
import { formatNumber } from "@/lib/format-number";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { BulkEditProgress } from "./bulk-edit-progress";

export type BulkEditScope =
  | { kind: "selection"; collectionIds: Id<"collections">[] }
  | { kind: "filters"; filters: CatalogFilters };

type Operation = BulkEdit["operation"];

const OPERATIONS: readonly Operation[] = ["set", "clear", "replace"];

/** The edit as staff fill it in, before it is shaped for the server. */
interface EditDraft {
  field: BulkEditField;
  operation: Operation;
  value: string;
  find: string;
  replaceWith: string;
  matchCase: boolean;
}

const EMPTY_DRAFT: EditDraft = {
  field: "culture",
  operation: "set",
  value: "",
  find: "",
  replaceWith: "",
  matchCase: false,
};

function updateDraft(draft: EditDraft, change: Partial<EditDraft>): EditDraft {
  const next = { ...draft, ...change };
  // Titles are required, so they can only be set or replaced.
  return next.field === "title" && next.operation === "clear"
    ? { ...next, operation: "set" }
    : next;
}

function editFromDraft(draft: EditDraft): BulkEdit {
  const { field, operation } = draft;
  switch (operation) {
    case "set":
      return { field, operation, value: draft.value };
    case "replace":
      return {
        field,
        operation,
        find: draft.find,
        replaceWith: draft.replaceWith,
        matchCase: draft.matchCase,
      };
    case "clear":
      return { field, operation };
  }
}

type BulkEditPreviewResult = FunctionReturnType<
  typeof api.bulkFieldEdits.preview
>;

/** Whether the server would accept the edit, so a preview can be asked for. */
function isComplete(edit: BulkEdit) {
  switch (edit.operation) {
    case "set": {
      const value = (edit.value ?? "").trim();
      return value !== "" && value.length <= BULK_EDIT_VALUE_LIMIT;
    }
    case "clear":
      return edit.field !== "title";
    case "replace":
      return (
        (edit.find ?? "") !== "" &&
        (edit.find ?? "").length <= BULK_EDIT_VALUE_LIMIT &&
        (edit.replaceWith ?? "").length <= BULK_EDIT_VALUE_LIMIT
      );
  }
}

interface BulkEditFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: Id<"organizations">;
  /**
   * The objects the edit covers, fixed when the dialog opens: clearing the
   * selection once the edit starts leaves its description as it was.
   */
  scope: BulkEditScope;
  /** Called once the edit is running, for example to clear the selection. */
  onStarted?: () => void;
  /** Takes focus on close when the control that opened it is gone. */
  fallbackFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Sets, clears or finds and replaces one field on a selection or on every
 * object matching the catalog's search and filters. The preview says how
 * many objects change and how many already hold a value the edit replaces,
 * before anything runs.
 */
export function BulkEditFieldDialog({
  open,
  onOpenChange,
  organizationId,
  scope,
  onStarted,
  fallbackFocusRef,
}: BulkEditFieldDialogProps) {
  const t = useScopedI18n("objects.bulkEdit");
  const tCommon = useScopedI18n("common");
  const locale = useCurrentLocale();
  const errorMessage = useBulkEditErrorMessage("start");
  const fieldId = useId();
  const valueId = useId();
  const findId = useId();
  const replaceId = useId();
  const matchCaseId = useId();
  const refusalId = useId();
  const [draft, changeDraft] = useReducer(updateDraft, EMPTY_DRAFT);
  const { field, operation } = draft;
  const [jobId, setJobId] = useState<Id<"bulkFieldEdits"> | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [isStarting, setStarting] = useState(false);
  const start = useMutation(api.bulkFieldEdits.start);

  const edit = editFromDraft(draft);
  // Typing settles before the preview counts again.
  const previewEdit = useDeferredValue(edit);
  const selectionTooLarge =
    scope.kind === "selection" &&
    scope.collectionIds.length > BULK_EDIT_MAX_SELECTION;
  const preview = useQuery(
    api.bulkFieldEdits.preview,
    open && !jobId && !selectionTooLarge && isComplete(previewEdit)
      ? { organizationId, scope, edit: previewEdit }
      : "skip",
  );

  const reset = () => {
    setJobId(null);
    setRefusal(null);
    changeDraft({ ...EMPTY_DRAFT, field });
  };
  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleStart = async () => {
    setStarting(true);
    setRefusal(null);
    try {
      setJobId(await start({ organizationId, scope, edit }));
      onStarted?.();
    } catch (error) {
      setRefusal({ message: errorMessage(error) });
    } finally {
      setStarting(false);
    }
  };

  const canStart =
    !jobId &&
    !isStarting &&
    !selectionTooLarge &&
    isComplete(edit) &&
    preview?.kind === "preview" &&
    // A capped preview has not seen every match, so more may change.
    (preview.changing > 0 || preview.capped);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent fallbackFocusRef={fallbackFocusRef} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {scope.kind === "selection"
              ? t("descriptionSelection", {
                  count: formatNumber(scope.collectionIds.length, locale),
                })
              : t("descriptionFilters")}
          </DialogDescription>
        </DialogHeader>

        {jobId ? (
          <BulkEditProgress jobId={jobId} />
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor={fieldId}>{t("field")}</Label>
              <Select
                value={field}
                onValueChange={(next) => {
                  const chosen = BULK_EDIT_FIELDS.find(
                    (candidate) => candidate === next,
                  );
                  if (chosen) changeDraft({ field: chosen });
                }}
              >
                <SelectTrigger id={fieldId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BULK_EDIT_FIELDS.map((candidate) => (
                    <SelectItem key={candidate} value={candidate}>
                      {t(`fields.${candidate}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t("operation")}</legend>
              <RadioGroup
                value={operation}
                onValueChange={(next) => {
                  const chosen = OPERATIONS.find(
                    (candidate) => candidate === next,
                  );
                  if (chosen) changeDraft({ operation: chosen });
                }}
              >
                {OPERATIONS.map((candidate) => (
                  <div key={candidate} className="flex items-center gap-2">
                    <RadioGroupItem
                      value={candidate}
                      id={`${fieldId}-${candidate}`}
                      disabled={candidate === "clear" && field === "title"}
                    />
                    <Label
                      htmlFor={`${fieldId}-${candidate}`}
                      className="font-normal"
                    >
                      {t(candidate)}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </fieldset>

            {operation === "set" ? (
              <div className="space-y-2">
                <Label htmlFor={valueId}>{t("value")}</Label>
                <Input
                  id={valueId}
                  value={draft.value}
                  maxLength={BULK_EDIT_VALUE_LIMIT}
                  onChange={(event) =>
                    changeDraft({ value: event.target.value })
                  }
                  aria-describedby={refusal ? refusalId : undefined}
                />
              </div>
            ) : null}

            {operation === "replace" ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor={findId}>{t("find")}</Label>
                  <Input
                    id={findId}
                    value={draft.find}
                    maxLength={BULK_EDIT_VALUE_LIMIT}
                    onChange={(event) =>
                      changeDraft({ find: event.target.value })
                    }
                    aria-describedby={refusal ? refusalId : undefined}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={replaceId}>{t("replaceWith")}</Label>
                  <Input
                    id={replaceId}
                    value={draft.replaceWith}
                    maxLength={BULK_EDIT_VALUE_LIMIT}
                    onChange={(event) =>
                      changeDraft({ replaceWith: event.target.value })
                    }
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={matchCaseId}
                    checked={draft.matchCase}
                    onCheckedChange={(checked) =>
                      changeDraft({ matchCase: checked === true })
                    }
                  />
                  <Label htmlFor={matchCaseId} className="font-normal">
                    {t("matchCase")}
                  </Label>
                </div>
              </div>
            ) : null}

            <BulkEditPreview
              preview={preview}
              selectionTooLarge={selectionTooLarge}
              complete={isComplete(edit)}
            />
            <ActionRefusal refusal={refusal} id={refusalId} />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {jobId ? tCommon("close") : tCommon("cancel")}
          </Button>
          {jobId ? null : (
            <Button onClick={handleStart} disabled={!canStart}>
              {isStarting ? t("starting") : t("start")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkEditPreview({
  preview,
  selectionTooLarge,
  complete,
}: {
  preview: BulkEditPreviewResult | undefined;
  selectionTooLarge: boolean;
  complete: boolean;
}) {
  const t = useScopedI18n("objects.bulkEdit");
  const locale = useCurrentLocale();
  const codeMessage = useBulkEditCodeMessage();
  if (selectionTooLarge) {
    return (
      <p className="rounded-md border border-border bg-muted/40 p-3 text-sm">
        {codeMessage("SELECTION_TOO_LARGE")}
      </p>
    );
  }
  if (!complete) return null;
  if (!preview) {
    return (
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t("previewLoading")}
      </p>
    );
  }
  if (preview.kind === "refused") {
    return (
      <p
        className="rounded-md border border-border bg-muted/40 p-3 text-sm"
        aria-live="polite"
      >
        {codeMessage(preview.code)}
      </p>
    );
  }
  const counts = {
    matching: formatNumber(preview.matching, locale),
    changing: formatNumber(preview.changing, locale),
  };
  const overwriting = formatNumber(preview.overwriting, locale);
  return (
    <div className="space-y-2 text-sm" aria-live="polite">
      <p>
        {preview.capped ? t("previewCapped", counts) : t("preview", counts)}
      </p>
      {preview.changing === 0 && !preview.capped ? (
        <p className="text-muted-foreground">{t("nothingChanges")}</p>
      ) : null}
      {preview.overwriting > 0 ? (
        <p className="flex items-start gap-2 rounded-md border border-status-warning/30 bg-status-warning/10 p-3 text-status-warning-foreground">
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          {preview.capped
            ? t("overwriteWarningCapped", { count: overwriting })
            : t("overwriteWarning", { count: overwriting })}
        </p>
      ) : null}
    </div>
  );
}
