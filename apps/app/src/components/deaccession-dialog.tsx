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
  Archive,
  Calendar as CalendarIcon,
  CheckCircle,
  DollarSign,
  Loader2,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type RemovalType = "sold" | "archived" | "deleted";

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
  const [removalType, setRemovalType] = useState<RemovalType | null>(null);
  const [date, setDate] = useState<Date>(new Date());
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState<
    "sale" | "donation" | "transfer" | "destruction"
  >("sale");
  const [disposition, setDisposition] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const createDeaccession = useMutation(api.deaccessions.create);
  const archiveCollection = useMutation(api.collections.archiveCollection);
  const softDeleteCollection = useMutation(
    api.collections.softDeleteCollection,
  );

  const workflowConfigs = useQuery(
    api.organizations.getWorkflowConfigs,
    organizationId ? { organizationId } : "skip",
  );

  const deaccessionWorkflow = workflowConfigs?.find(
    (w: { workflowType: string }) => w.workflowType === "deaccession",
  );

  const resetForm = () => {
    setRemovalType(null);
    setReason("");
    setDisposition("");
    setNotes("");
    setDate(new Date());
    setMethod("sale");
    setError(null);
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError("Reason is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (removalType === "sold") {
        await createDeaccession({
          organizationId,
          collectionId,
          dateDeaccessioned: date.getTime(),
          reason: reason.trim(),
          method,
          disposition: disposition.trim() || undefined,
          notes: notes.trim() || undefined,
        });
        resetForm();
        onOpenChange(false);
        router.push("/deaccessions");
      } else if (removalType === "archived") {
        await archiveCollection({
          collectionId,
          reason: reason.trim(),
        });
        resetForm();
        onOpenChange(false);
        router.push("/objects");
      } else if (removalType === "deleted") {
        await softDeleteCollection({
          collectionId,
          reason: reason.trim(),
        });
        resetForm();
        onOpenChange(false);
        router.push("/objects");
      }
    } catch (err) {
      console.error("Failed to process removal:", err);
      setError(
        err instanceof Error ? err.message : "Failed to process removal",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Remove Object</DialogTitle>
          <DialogDescription>
            Choose how to remove "{collectionTitle}" from the collection.
          </DialogDescription>
        </DialogHeader>

        {!removalType && (
          <div className="grid gap-4 py-4">
            <button
              type="button"
              onClick={() => setRemovalType("sold")}
              className="flex items-start gap-4 rounded-lg border border-border p-4 text-left hover:bg-muted/50 transition-colors"
            >
              <div className="rounded-full bg-green-500/10 p-2">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Object Sold</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Record the sale of this object. Enter details about the
                  transaction including buyer information and sale price.
                </p>
                {deaccessionWorkflow && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                    Requires approval workflow
                  </p>
                )}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setRemovalType("archived")}
              className="flex items-start gap-4 rounded-lg border border-border p-4 text-left hover:bg-muted/50 transition-colors"
            >
              <div className="rounded-full bg-amber-500/10 p-2">
                <Archive className="h-5 w-5 text-amber-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Archive Object</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Remove from active collection but preserve all data, history,
                  and media. The object will no longer be visible in normal
                  views but can be restored later.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setRemovalType("deleted")}
              className="flex items-start gap-4 rounded-lg border border-border p-4 text-left hover:bg-muted/50 transition-colors"
            >
              <div className="rounded-full bg-red-500/10 p-2">
                <Trash2 className="h-5 w-5 text-red-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Delete Object</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Move to trash. Use this if the object was added incorrectly or
                  is a duplicate. Can be permanently deleted later or restored.
                </p>
              </div>
            </button>
          </div>
        )}

        {removalType === "sold" && (
          <div className="space-y-4 py-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRemovalType(null)}
              className="mb-2"
            >
              ← Back to options
            </Button>

            {deaccessionWorkflow && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 dark:bg-blue-950 dark:border-blue-800">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-900 dark:text-blue-100">
                      Approval Required
                    </p>
                    <p className="text-blue-700 dark:text-blue-300 mt-1">
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

            {!deaccessionWorkflow && workflowConfigs !== undefined && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 dark:bg-amber-950 dark:border-amber-800">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-900 dark:text-amber-100">
                      No Approval Workflow
                    </p>
                    <p className="text-amber-700 dark:text-amber-300 mt-1">
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

            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Sale *</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe why this object is being sold..."
                rows={3}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="method">Sale Method *</Label>
              <Select
                value={method}
                onValueChange={(v) => setMethod(v as typeof method)}
              >
                <SelectTrigger id="method">
                  <SelectValue placeholder="Select sale method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sale">
                    Direct Sale - Sold to buyer
                  </SelectItem>
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
                onChange={(e) => setDisposition(e.target.value)}
                placeholder="Buyer name, sale price, auction house..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional comments..."
                rows={2}
              />
            </div>
          </div>
        )}

        {removalType === "archived" && (
          <div className="space-y-4 py-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRemovalType(null)}
              className="mb-2"
            >
              ← Back to options
            </Button>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 dark:bg-amber-950 dark:border-amber-800">
              <div className="flex items-start gap-3">
                <Archive className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-900 dark:text-amber-100">
                    Archiving Object
                  </p>
                  <p className="text-amber-700 dark:text-amber-300 mt-1">
                    This object will be removed from the active collection but
                    all data, history, and media will be preserved. You can
                    restore it at any time.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="archive-reason">
                Reason for Archiving <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="archive-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reason for archiving this object..."
                rows={4}
                required
              />
            </div>
          </div>
        )}

        {removalType === "deleted" && (
          <div className="space-y-4 py-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRemovalType(null)}
              className="mb-2"
            >
              ← Back to options
            </Button>

            <div className="rounded-lg bg-red-50 border border-red-200 p-4 dark:bg-red-950 dark:border-red-800">
              <div className="flex items-start gap-3">
                <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-red-900 dark:text-red-100">
                    Deleting Object
                  </p>
                  <p className="text-red-700 dark:text-red-300 mt-1">
                    This object will be moved to trash. Use this if the object
                    was added incorrectly or is a duplicate. You can restore it
                    later or permanently delete it from trash.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="delete-reason">
                Reason for Deleting <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="delete-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reason for deleting this object (e.g., duplicate entry, added in error)..."
                rows={4}
                required
              />
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {removalType && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !reason.trim()}
              variant={removalType === "deleted" ? "destructive" : "default"}
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {removalType === "sold" && "Submit for Approval"}
              {removalType === "archived" && "Archive Object"}
              {removalType === "deleted" && "Delete Object"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
