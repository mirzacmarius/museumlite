"use client";

import { Archive, ArrowRightLeft, DollarSign } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/locales/client";
import type { ObjectActions, RemovalType } from "./deaccession-dialog-types";

interface DeaccessionTypePickerProps {
  /** Undefined while loading. */
  actions?: ObjectActions;
  onSelect: (type: RemovalType) => void;
}

type ObjectAction = ObjectActions["deaccession"] | ObjectActions["remove"];

function useUnavailableReason() {
  const translate = useI18n();
  return (action: ObjectAction) => {
    if (action.state === "in_progress")
      return translate("objects.deaccessionAction.inProgress");
    if (action.state !== "blocked") return null;
    return action.reason === "on_loan"
      ? translate("objects.deaccessionAction.onLoan")
      : translate("objects.deaccessionAction.notAccessioned");
  };
}

interface PickerOptionProps {
  icon: ReactNode;
  title: string;
  description: string;
  note?: string | null;
  unavailableReason?: string | null;
  disabled?: boolean;
  onSelect: () => void;
}

function PickerOption({
  icon,
  title,
  description,
  note,
  unavailableReason,
  disabled,
  onSelect,
}: PickerOptionProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled || Boolean(unavailableReason)}
      className="flex items-start gap-4 rounded-lg border border-border p-4 text-left transition-colors enabled:hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {icon}
      <div className="flex-1">
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        {unavailableReason ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {unavailableReason}
          </p>
        ) : note ? (
          <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
            {note}
          </p>
        ) : null}
      </div>
    </button>
  );
}

export function DeaccessionTypePicker({
  actions,
  onSelect,
}: DeaccessionTypePickerProps) {
  const translate = useI18n();
  const unavailableReason = useUnavailableReason();
  const loading = actions === undefined;
  return (
    <div className="grid gap-4 py-4">
      {actions?.deaccession.state !== "hidden" && (
        <PickerOption
          icon={
            <div className="rounded-full bg-green-500/10 p-2">
              <DollarSign className="size-5 text-green-500" />
            </div>
          }
          title={translate("untranslatedComponents.labels.objectSold")}
          description={translate(
            "untranslatedComponents.labels.recordTheSaleOfThisObjectEnterDetailsAboutTheTransactionIncludingBuyerInformationAndSalePrice",
          )}
          note={
            actions?.deaccession.state === "available" &&
            actions.deaccession.approvalSteps > 0
              ? translate(
                  "untranslatedComponents.labels.requiresApprovalWorkflow",
                )
              : null
          }
          unavailableReason={actions && unavailableReason(actions.deaccession)}
          disabled={loading}
          onSelect={() => onSelect("sold")}
        />
      )}

      <PickerOption
        icon={
          <div className="rounded-full bg-blue-500/10 p-2">
            <ArrowRightLeft className="size-5 text-blue-500" />
          </div>
        }
        title={translate(
          "untranslatedComponents.labels.moveToAnotherOrganization",
        )}
        description={translate(
          "untranslatedComponents.labels.requestApprovalToTransferThisObjectToAnotherOrganizationYouBelongToYouCanKeepTheCurrentAccessionNumberOrAssignANewOne",
        )}
        note={translate(
          "untranslatedComponents.labels.requiresAdministratorApprovalBeforeTheMoveIsExecuted",
        )}
        onSelect={() => onSelect("move")}
      />

      {actions?.remove.state !== "hidden" && (
        <PickerOption
          icon={
            <div className="rounded-full bg-amber-500/10 p-2">
              <Archive className="size-5 text-amber-500" />
            </div>
          }
          title={translate("untranslatedComponents.labels.removeObject")}
          description={translate(
            "untranslatedComponents.labels.removeFromTheActiveCollectionButPreserveAllDataHistoryAndMediaTheObjectCanBeRestoredLater",
          )}
          unavailableReason={actions && unavailableReason(actions.remove)}
          disabled={loading}
          onSelect={() => onSelect("archived")}
        />
      )}
    </div>
  );
}
