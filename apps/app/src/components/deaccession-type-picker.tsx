"use client";

import { Archive, ArrowRightLeft, DollarSign } from "lucide-react";
import type {
  DeaccessionWorkflowConfig,
  RemovalType,
} from "./deaccession-dialog-types";

interface DeaccessionTypePickerProps {
  deaccessionWorkflow?: DeaccessionWorkflowConfig;
  onSelect: (type: RemovalType) => void;
}

export function DeaccessionTypePicker({
  deaccessionWorkflow,
  onSelect,
}: DeaccessionTypePickerProps) {
  return (
    <div className="grid gap-4 py-4">
      <button
        type="button"
        onClick={() => onSelect("sold")}
        className="flex items-start gap-4 rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted/50"
      >
        <div className="rounded-full bg-green-500/10 p-2">
          <DollarSign className="size-5 text-green-500" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">Object Sold</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Record the sale of this object. Enter details about the transaction
            including buyer information and sale price.
          </p>
          {deaccessionWorkflow && (
            <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
              Requires approval workflow
            </p>
          )}
        </div>
      </button>

      <button
        type="button"
        onClick={() => onSelect("move")}
        className="flex items-start gap-4 rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted/50"
      >
        <div className="rounded-full bg-blue-500/10 p-2">
          <ArrowRightLeft className="size-5 text-blue-500" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">Move to Another Organization</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Request approval to transfer this object to another organization you
            belong to. You can keep the current accession number or assign a new
            one.
          </p>
          <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
            Requires administrator approval before the move is executed
          </p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onSelect("archived")}
        className="flex items-start gap-4 rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted/50"
      >
        <div className="rounded-full bg-amber-500/10 p-2">
          <Archive className="size-5 text-amber-500" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">Archive Object</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Withdraw from routine views while preserving the register, linked
            evidence, and media. An authorized user can restore it later.
          </p>
        </div>
      </button>
    </div>
  );
}
