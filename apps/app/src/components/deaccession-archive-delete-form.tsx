"use client";

import { Button } from "@v1/ui/button";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { Archive } from "lucide-react";
import { useI18n } from "@/locales/client";

interface DeaccessionArchiveDeleteFormProps {
  isDirectRemovalFlow: boolean;
  reason: string;
  onBack: () => void;
  onReasonChange: (reason: string) => void;
}

export function DeaccessionArchiveDeleteForm({
  isDirectRemovalFlow,
  reason,
  onBack,
  onReasonChange,
}: DeaccessionArchiveDeleteFormProps) {
  const translate = useI18n();
  return (
    <div className="space-y-4 py-4">
      {!isDirectRemovalFlow && (
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-2">
          {translate("untranslatedComponents.labels.backToOptions")}
        </Button>
      )}

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
        <div className="flex items-start gap-3">
          <Archive className="mt-0.5 size-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-100">
              {translate("untranslatedComponents.deaccession.archivingObject")}
            </p>
            <p className="mt-1 text-amber-700 dark:text-amber-300">
              {translate(
                "untranslatedComponents.deaccession.archiveDescription",
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="archived-reason">
          {translate("untranslatedComponents.deaccession.reasonForArchiving")}{" "}
          <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="archived-reason"
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          placeholder={translate(
            "untranslatedComponents.deaccession.enterArchiveReason",
          )}
          rows={4}
          required
        />
      </div>
    </div>
  );
}
