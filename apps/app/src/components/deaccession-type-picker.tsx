"use client";

import { Archive, ArrowRightLeft, DollarSign } from "lucide-react";
import { useI18n } from "@/locales/client";
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
  const translate = useI18n();
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
          <h3 className="font-semibold">
            {translate("untranslatedComponents.labels.objectSold")}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {translate(
              "untranslatedComponents.labels.recordTheSaleOfThisObjectEnterDetailsAboutTheTransactionIncludingBuyerInformationAndSalePrice",
            )}
          </p>
          {deaccessionWorkflow && (
            <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
              {translate(
                "untranslatedComponents.labels.requiresApprovalWorkflow",
              )}
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
          <h3 className="font-semibold">
            {translate(
              "untranslatedComponents.labels.moveToAnotherOrganization",
            )}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {translate(
              "untranslatedComponents.labels.requestApprovalToTransferThisObjectToAnotherOrganizationYouBelongToYouCanKeepTheCurrentAccessionNumberOrAssignANewOne",
            )}
          </p>
          <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
            {translate(
              "untranslatedComponents.labels.requiresAdministratorApprovalBeforeTheMoveIsExecuted",
            )}
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
          <h3 className="font-semibold">
            {translate("untranslatedComponents.labels.archiveObject")}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {translate(
              "untranslatedComponents.labels.removeFromTheActiveCollectionButPreserveAllDataHistoryAndMediaTheObjectCanBeRestoredLater",
            )}
          </p>
        </div>
      </button>
    </div>
  );
}
