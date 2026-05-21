"use client";

import { Button } from "@v1/ui/button";
import { Calendar } from "@v1/ui/calendar";
import { Label } from "@v1/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Textarea } from "@v1/ui/textarea";
import { cn } from "@v1/ui/utils";
import { format } from "date-fns";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CheckCircle,
} from "lucide-react";
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
  return (
    <div className="space-y-4 py-4">
      {!isDirectRemovalFlow && (
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-2">
          ← Back to options
        </Button>
      )}

      {deaccessionWorkflow && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
          <div className="flex items-start gap-3">
            <CheckCircle className="mt-0.5 size-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
            <div className="text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100">
                Approval Required
              </p>
              <p className="mt-1 text-blue-700 dark:text-blue-300">
                This sale requires{" "}
                {deaccessionWorkflow.steps.length === 1
                  ? "administrator approval"
                  : `${deaccessionWorkflow.steps.length} approval steps`}{" "}
                before the item is marked as sold.
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
                No Approval Workflow
              </p>
              <p className="mt-1 text-amber-700 dark:text-amber-300">
                This sale will be automatically approved.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="date">Date of Sale *</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !date && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-2 size-4" />
              {date ? format(date, "PPP") : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(selectedDate) =>
                selectedDate && onDateChange(selectedDate)
              }
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reason">Reason for Sale *</Label>
        <Textarea
          id="reason"
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          placeholder="Describe why this object is being sold..."
          rows={3}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="method">Sale Method *</Label>
        <Select value={method} onValueChange={onMethodChange}>
          <SelectTrigger id="method">
            <SelectValue placeholder="Select sale method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sale">Direct Sale - Sold to buyer</SelectItem>
            <SelectItem value="donation">
              Donation - Given to institution
            </SelectItem>
            <SelectItem value="transfer">
              Transfer - Moved to related entity
            </SelectItem>
            <SelectItem value="destruction">
              Destruction - Object destroyed
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="disposition">Sale Details</Label>
        <Textarea
          id="disposition"
          value={disposition}
          onChange={(event) => onDispositionChange(event.target.value)}
          placeholder="Buyer name, sale price, auction house..."
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Additional Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          placeholder="Any additional comments..."
          rows={2}
        />
      </div>
    </div>
  );
}
