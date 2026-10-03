"use client";

import { Button } from "@v1/ui/button";
import { DatePicker } from "@v1/ui/date-picker";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Textarea } from "@v1/ui/textarea";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { useI18n } from "@/locales/client";
import type { DeaccessionWorkflowConfig } from "./deaccession-dialog-types";

interface DeaccessionSoldFormProps {
  isDirectRemovalFlow: boolean;
  deaccessionWorkflow?: DeaccessionWorkflowConfig;
  workflowConfigsLoaded: boolean;
  date: Date;
  reason: string;
  method: "sale" | "donation" | "transfer" | "destruction";
  disposition: string;
  notes: string;
  onBack: () => void;
  onDateChange: (date: Date) => void;
  onReasonChange: (reason: string) => void;
  onMethodChange: (method: DeaccessionSoldFormProps["method"]) => void;
  onDispositionChange: (disposition: string) => void;
  onNotesChange: (notes: string) => void;
}

export function DeaccessionSoldForm({
  isDirectRemovalFlow,
  deaccessionWorkflow,
  workflowConfigsLoaded,
  date,
  reason,
  method,
  disposition,
  notes,
  onBack,
  onDateChange,
  onReasonChange,
  onMethodChange,
  onDispositionChange,
  onNotesChange,
}: DeaccessionSoldFormProps) {
  const translate = useI18n();
  return (
    <div className="space-y-4 py-4">
      {!isDirectRemovalFlow && (
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-2">
          {translate("untranslatedComponents.labels.backToOptions")}
        </Button>
      )}

      {deaccessionWorkflow && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
          <div className="flex items-start gap-3">
            <CheckCircle className="mt-0.5 size-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
            <div className="text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100">
                {translate("untranslatedComponents.labels.approvalRequired")}
              </p>
              <p className="mt-1 text-blue-700 dark:text-blue-300">
                {translate("untranslatedComponents.labels.thisSaleRequires")}{" "}
                {deaccessionWorkflow.steps.length === 1
                  ? translate(
                      "untranslatedComponents.deaccession.administratorApproval",
                    )
                  : translate(
                      "untranslatedComponents.deaccession.approvalSteps",
                      {
                        count: deaccessionWorkflow.steps.length,
                      },
                    )}{" "}
                {translate(
                  "untranslatedComponents.labels.beforeTheItemIsMarkedAsSold",
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {!deaccessionWorkflow && workflowConfigsLoaded && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="text-sm">
              <p className="font-medium text-amber-900 dark:text-amber-100">
                {translate("untranslatedComponents.labels.noApprovalWorkflow")}
              </p>
              <p className="mt-1 text-amber-700 dark:text-amber-300">
                {translate(
                  "untranslatedComponents.labels.thisSaleWillBeAutomaticallyApproved",
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      <DatePicker
        label={translate("untranslatedComponents.labels.dateOfSale")}
        id="date"
        date={date}
        onSelect={(selectedDate) => selectedDate && onDateChange(selectedDate)}
        placeholder={translate("untranslatedComponents.labels.pickADate")}
      />

      <div className="space-y-2">
        <Label htmlFor="reason">
          {translate("untranslatedComponents.labels.reasonForSale")}
        </Label>
        <Textarea
          id="reason"
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          placeholder={translate(
            "untranslatedComponents.labels.describeWhyThisObjectIsBeingSold",
          )}
          rows={3}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="method">
          {translate("untranslatedComponents.labels.saleMethod")}
        </Label>
        <Select value={method} onValueChange={onMethodChange}>
          <SelectTrigger id="method">
            <SelectValue
              placeholder={translate(
                "untranslatedComponents.labels.selectSaleMethod",
              )}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sale">
              {translate("untranslatedComponents.labels.directSaleSoldToBuyer")}
            </SelectItem>
            <SelectItem value="donation">
              {translate(
                "untranslatedComponents.labels.donationGivenToInstitution",
              )}
            </SelectItem>
            <SelectItem value="transfer">
              {translate(
                "untranslatedComponents.labels.transferMovedToRelatedEntity",
              )}
            </SelectItem>
            <SelectItem value="destruction">
              {translate(
                "untranslatedComponents.labels.destructionObjectDestroyed",
              )}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="disposition">
          {translate("untranslatedComponents.labels.saleDetails")}
        </Label>
        <Textarea
          id="disposition"
          value={disposition}
          onChange={(event) => onDispositionChange(event.target.value)}
          placeholder={translate(
            "untranslatedComponents.labels.buyerNameSalePriceAuctionHouse",
          )}
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">
          {translate("untranslatedComponents.labels.additionalNotes")}
        </Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          placeholder={translate(
            "untranslatedComponents.labels.anyAdditionalComments",
          )}
          rows={2}
        />
      </div>
    </div>
  );
}
