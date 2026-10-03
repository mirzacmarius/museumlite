"use client";

import { Button } from "@v1/ui/button";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { Archive, Trash2 } from "lucide-react";
import { useI18n } from "@/locales/client";

interface DeaccessionArchiveDeleteFormProps {
  variant: "archived" | "deleted";
  isDirectRemovalFlow: boolean;
  reason: string;
  onBack: () => void;
  onReasonChange: (reason: string) => void;
}

export function DeaccessionArchiveDeleteForm({
  variant,
  isDirectRemovalFlow,
  reason,
  onBack,
  onReasonChange,
}: DeaccessionArchiveDeleteFormProps) {
  const translate = useI18n();
  const isArchive = variant === "archived";

  return (
    <div className="space-y-4 py-4">
      {!isDirectRemovalFlow && (
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-2">
          {translate("untranslatedComponents.labels.backToOptions")}
        </Button>
      )}

      <div
        className={
          isArchive
            ? "rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950"
            : "rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950"
        }
      >
        <div className="flex items-start gap-3">
          {isArchive ? (
            <Archive className="mt-0.5 size-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          ) : (
            <Trash2 className="mt-0.5 size-5 flex-shrink-0 text-red-600 dark:text-red-400" />
          )}
          <div className="text-sm">
            <p
              className={
                isArchive
                  ? "font-medium text-amber-900 dark:text-amber-100"
                  : "font-medium text-red-900 dark:text-red-100"
              }
            >
              {isArchive
                ? translate(
                    "untranslatedComponents.deaccession.archivingObject",
                  )
                : translate(
                    "untranslatedComponents.deaccession.deletingObject",
                  )}
            </p>
            <p
              className={
                isArchive
                  ? "mt-1 text-amber-700 dark:text-amber-300"
                  : "mt-1 text-red-700 dark:text-red-300"
              }
            >
              {isArchive
                ? translate(
                    "untranslatedComponents.deaccession.archiveDescription",
                  )
                : translate(
                    "untranslatedComponents.deaccession.deleteDescription",
                  )}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${variant}-reason`}>
          {isArchive
            ? translate("untranslatedComponents.deaccession.reasonForArchiving")
            : translate(
                "untranslatedComponents.deaccession.reasonForDeleting",
              )}{" "}
          <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id={`${variant}-reason`}
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          placeholder={
            isArchive
              ? translate(
                  "untranslatedComponents.deaccession.enterArchiveReason",
                )
              : translate(
                  "untranslatedComponents.deaccession.enterDeleteReason",
                )
          }
          rows={4}
          required
        />
      </div>
    </div>
  );
}
