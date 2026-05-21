"use client";

import { Button } from "@v1/ui/button";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { Archive, Trash2 } from "lucide-react";

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
  const isArchive = variant === "archived";

  return (
    <div className="space-y-4 py-4">
      {!isDirectRemovalFlow && (
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-2">
          ← Back to options
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
              {isArchive ? "Archiving Object" : "Deleting Object"}
            </p>
            <p
              className={
                isArchive
                  ? "mt-1 text-amber-700 dark:text-amber-300"
                  : "mt-1 text-red-700 dark:text-red-300"
              }
            >
              {isArchive
                ? "This object will be sent to Deaccessions for approval before it is archived. Once approved, all data, history, and media will be preserved and the object can be restored later."
                : "This object will be sent to Deaccessions for approval before it is marked as deleted and hidden from the Objects catalog. Use this if the object was added incorrectly or is a duplicate."}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${variant}-reason`}>
          {isArchive ? "Reason for Archiving" : "Reason for Deleting"}{" "}
          <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id={`${variant}-reason`}
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          placeholder={
            isArchive
              ? "Enter reason for archiving this object..."
              : "Enter reason for deleting this object (for example, duplicate entry or added in error)..."
          }
          rows={4}
          required
        />
      </div>
    </div>
  );
}
