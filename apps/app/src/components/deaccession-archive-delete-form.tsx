"use client";

import { Button } from "@v1/ui/button";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { Archive } from "lucide-react";

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
  return (
    <div className="space-y-4 py-4">
      {!isDirectRemovalFlow && (
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-2">
          ← Back to options
        </Button>
      )}

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
        <div className="flex items-start gap-3">
          <Archive className="mt-0.5 size-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-100">
              Archiving Object
            </p>
            <p className="mt-1 text-amber-700 dark:text-amber-300">
              This object will leave routine catalog views. Its register, linked
              evidence, and files remain available in the archive, and an
              authorized staff member can restore it later.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="archived-reason">
          Reason for Archiving <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="archived-reason"
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          placeholder="Enter the reason for withdrawing this object from routine catalog views..."
          rows={4}
          required
        />
      </div>
    </div>
  );
}
