"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  BULK_EDIT_FIELDS,
  BULK_EDIT_MAX_SELECTION,
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
import { AlertTriangle } from "lucide-react";
import { type RefObject, useDeferredValue, useId, useState } from "react";
import { ActionRefusal, type Refusal } from "@/components/action-refusal";
import { useBulkEditErrorMessage } from "@/hooks/use-bulk-edit-error-message";
import { useScopedI18n } from "@/locales/client";
import { BulkEditProgress } from "./bulk-edit-progress";

export type BulkEditScope =
  | { kind: "selection"; collectionIds: Id<"collections">[] }
  | { kind: "filters"; filters: CatalogFilters };

type Operation = BulkEdit["operation"];

const OPERATIONS: readonly Operation[] = ["set", "clear", "replace"];

/** Whether the server would accept the edit, so a preview can be asked for. */
function isComplete(edit: BulkEdit) {
  switch (edit.operation) {
    case "set":
      return (edit.value ?? "").trim() !== "";
    case "clear":
      return edit.field !== "title";
    case "replace":
      return (edit.find ?? "") !== "";
  }
}

interface BulkEditFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: Id<"organizations">;
  scope: BulkEditScope;
  /**
   * Called once the edit is running, for example to clear the selection.
   * Mount the dialog anew for each opening: it keeps the scope it opened with.
   */
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
  scope: openedScope,
  onStarted,
  fallbackFocusRef,
}: BulkEditFieldDialogProps) {
  // The scope as the dialog opened; clearing the selection once the edit
  // starts leaves the running edit's description as it was.
  const [scope] = useState(openedScope);
  const t = useScopedI18n("objects.bulkEdit");
  const tCommon = useScopedI18n("common");
  const errorMessage = useBulkEditErrorMessage();
  const fieldId = useId();
  const valueId = useId();
  const findId = useId();
  const replaceId = useId();
  const matchCaseId = useId();
  const refusalId = useId();
  const [field, setField] = useState<BulkEditField>("culture");
  const [operation, setOperation] = useState<Operation>("set");
  const [value, setValue] = useState("");
  const [find, setFind] = useState("");
  const [replaceWith, setReplaceWith] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [jobId, setJobId] = useState<Id<"bulkFieldEdits"> | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [isStarting, setStarting] = useState(false);
  const start = useMutation(api.bulkFieldEdits.start);

  const edit: BulkEdit =
    operation === "set"
      ? { field, operation, value }
      : operation === "replace"
        ? { field, operation, find, replaceWith, matchCase }
        : { field, operation };
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
    setValue("");
    setFind("");
    setReplaceWith("");
    setMatchCase(false);
    setOperation("set");
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
    preview !== undefined &&
    preview.changing > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent fallbackFocusRef={fallbackFocusRef} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {scope.kind === "selection"
              ? t("descriptionSelection", {
                  count: scope.collectionIds.length,
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
                  if (!chosen) return;
                  setField(chosen);
                  // Titles are required, so they can only be set or replaced.
                  if (chosen === "title" && operation === "clear") {
                    setOperation("set");
                  }
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
                  if (chosen) setOperation(chosen);
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
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
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
                    value={find}
                    onChange={(event) => setFind(event.target.value)}
                    aria-describedby={refusal ? refusalId : undefined}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={replaceId}>{t("replaceWith")}</Label>
                  <Input
                    id={replaceId}
                    value={replaceWith}
                    onChange={(event) => setReplaceWith(event.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={matchCaseId}
                    checked={matchCase}
                    onCheckedChange={(checked) =>
                      setMatchCase(checked === true)
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
  preview:
    | {
        matching: number;
        changing: number;
        overwriting: number;
        capped: boolean;
      }
    | undefined;
  selectionTooLarge: boolean;
  complete: boolean;
}) {
  const t = useScopedI18n("objects.bulkEdit");
  if (selectionTooLarge) {
    return (
      <p className="rounded-md border border-border bg-muted/40 p-3 text-sm">
        {t("errors.selectionTooLarge")}
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
  return (
    <div className="space-y-2 text-sm" aria-live="polite">
      <p>
        {t("preview", {
          matching: preview.matching,
          changing: preview.changing,
        })}
      </p>
      {preview.capped ? (
        <p className="text-muted-foreground">
          {t("previewCapped", { matching: preview.matching })}
        </p>
      ) : null}
      {preview.changing === 0 ? (
        <p className="text-muted-foreground">{t("nothingChanges")}</p>
      ) : null}
      {preview.overwriting > 0 ? (
        <p className="flex items-start gap-2 rounded-md border border-status-warning/30 bg-status-warning/10 p-3 text-status-warning-foreground">
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          {t("overwriteWarning", { count: preview.overwriting })}
        </p>
      ) : null}
    </div>
  );
}
