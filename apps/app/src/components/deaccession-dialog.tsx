"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Calendar } from "@v1/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
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
import { useMutation, useQuery } from "convex/react";
import { format } from "date-fns";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CheckCircle,
  Info,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface DeaccessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionId: Id<"collections">;
  collectionTitle: string;
  organizationId: Id<"organizations">;
}

export function DeaccessionDialog({
  open,
  onOpenChange,
  collectionId,
  collectionTitle,
  organizationId,
}: DeaccessionDialogProps) {
  // State management
  const [date, setDate] = useState<Date>(new Date());
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState<
    "sale" | "donation" | "transfer" | "destruction"
  >("donation");
  const [disposition, setDisposition] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const createDeaccession = useMutation(api.deaccessions.create);

  // Query workflow configuration to show approval info
  const workflowConfigs = useQuery(
    api.organizations.getWorkflowConfigs,
    organizationId ? { organizationId } : "skip",
  );

  const deaccessionWorkflow = workflowConfigs?.find(
    (w: { workflowType: string }) => w.workflowType === "deaccession",
  );

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError("Reason is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await createDeaccession({
        organizationId,
        collectionId,
        dateDeaccessioned: date.getTime(),
        reason: reason.trim(),
        method,
        disposition: disposition.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      // Success - reset form and close
      setReason("");
      setDisposition("");
      setNotes("");
      setDate(new Date());
      onOpenChange(false);

      // Navigate to deaccessions list
      router.push("/deaccessions");
    } catch (err) {
      console.error("Failed to create deaccession:", err);
      setError(
        err instanceof Error ? err.message : "Failed to create deaccession",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Deaccession Object</DialogTitle>
          <DialogDescription>
            Remove "{collectionTitle}" from the collection.
          </DialogDescription>
        </DialogHeader>

        {/* Workflow Status Info */}
        {deaccessionWorkflow && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 dark:bg-blue-950 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  Approval Required
                </p>
                <p className="text-blue-700 dark:text-blue-300 mt-1">
                  This deaccession requires{" "}
                  {deaccessionWorkflow.steps.length === 1
                    ? "administrator approval"
                    : `${deaccessionWorkflow.steps.length} approval steps`}{" "}
                  before the item is removed from the collection.
                </p>
              </div>
            </div>
          </div>
        )}

        {!deaccessionWorkflow && workflowConfigs !== undefined && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 dark:bg-amber-950 dark:border-amber-800">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-amber-900 dark:text-amber-100">
                  No Approval Workflow
                </p>
                <p className="text-amber-700 dark:text-amber-300 mt-1">
                  This deaccession will be automatically approved. Contact an
                  administrator to set up approval workflows in organization
                  settings.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4 py-4">
          {/* Date Picker */}
          <div className="space-y-2">
            <Label htmlFor="date">Date Deaccessioned *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Deaccession *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe why this object is being deaccessioned (e.g., no longer fits mission, damaged beyond repair, duplicate item)..."
              rows={4}
              required
            />
            {!reason.trim() && error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          {/* Method */}
          <div className="space-y-2">
            <Label htmlFor="method">Method *</Label>
            <Select
              value={method}
              onValueChange={(v) => setMethod(v as typeof method)}
            >
              <SelectTrigger id="method">
                <SelectValue placeholder="Select disposal method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sale">
                  Sale - Sold to another institution or collector
                </SelectItem>
                <SelectItem value="donation">
                  Donation - Given to another institution or organization
                </SelectItem>
                <SelectItem value="transfer">
                  Transfer - Transferred within organization or to related
                  entity
                </SelectItem>
                <SelectItem value="destruction">
                  Destruction - Object destroyed or discarded
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Disposition */}
          <div className="space-y-2">
            <Label htmlFor="disposition">Disposition</Label>
            <Textarea
              id="disposition"
              value={disposition}
              onChange={(e) => setDisposition(e.target.value)}
              placeholder="Details about where/how the object was disposed (e.g., recipient name, sale price, date of disposal)..."
              rows={3}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional comments or documentation references..."
              rows={3}
            />
          </div>

          {error && !reason.trim() === false && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !reason.trim()}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit for Approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
