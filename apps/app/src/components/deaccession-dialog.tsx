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
import { Input } from "@v1/ui/input";
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
  ArrowRightLeft,
  Calendar as CalendarIcon,
  CheckCircle,
  DollarSign,
  Loader2,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type RemovalType = "sold" | "archived" | "deleted" | "move";
type AccessionMode = "keep" | "auto" | "manual";

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
  const [accessionMode, setAccessionMode] = useState<AccessionMode>("keep");
  const [targetOrganizationId, setTargetOrganizationId] = useState<
    Id<"organizations"> | ""
  >("");
  const [manualAccessionNumber, setManualAccessionNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const createDeaccession = useMutation(api.deaccessions.create);
  const createMoveRequest = useMutation(api.objectMoves.createRequest);

  const workflowConfigs = useQuery(
    api.organizations.getWorkflowConfigs,
    organizationId ? { organizationId } : "skip",
  );
  const targetOrganizations = useQuery(
    api.objectMoves.listEligibleTargetOrganizations,
    open ? { collectionId } : "skip",
  );
  const moveEligibility = useQuery(
    api.objectMoves.getEligibility,
    removalType === "move" && targetOrganizationId
      ? {
          collectionId,
          targetOrganizationId: targetOrganizationId as Id<"organizations">,
        }
      : open
        ? {
            collectionId,
          }
        : "skip",
  );

  const deaccessionWorkflow = workflowConfigs?.find(
    (workflow: { workflowType: string }) =>
      workflow.workflowType === "deaccession",
  );

  const resetForm = () => {
    setRemovalType(null);
    setReason("");
    setDisposition("");
    setNotes("");
    setDate(new Date());
    setMethod("sale");
    setAccessionMode("keep");
    setTargetOrganizationId("");
    setManualAccessionNumber("");
    setError(null);
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError("Reason is required");
      return;
    }

    if (removalType === "move") {
      if (!targetOrganizationId) {
        setError("Destination organization is required");
        return;
      }

      if (accessionMode === "manual" && !manualAccessionNumber.trim()) {
        setError("A manual accession number is required");
        return;
      }

      if (moveEligibility && !moveEligibility.isEligible) {
        setError(
          "This object cannot be moved until the blocking issues are resolved",
        );
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (removalType === "sold") {
        const deaccessionId = await createDeaccession({
          organizationId,
          collectionId,
          dateDeaccessioned: date.getTime(),
          reason: reason.trim(),
          method,
          targetCollectionStatus: "deaccessioned",
          disposition: disposition.trim() || undefined,
          notes: notes.trim() || undefined,
        });
        resetForm();
        onOpenChange(false);
        router.push(`/deaccessions/${deaccessionId}`);
      } else if (removalType === "archived") {
        const deaccessionId = await createDeaccession({
          organizationId,
          collectionId,
          dateDeaccessioned: date.getTime(),
          reason: reason.trim(),
          method: "destruction",
          targetCollectionStatus: "archived",
          notes: notes.trim() || undefined,
        });
        resetForm();
        onOpenChange(false);
        router.push(`/deaccessions/${deaccessionId}`);
      } else if (removalType === "deleted") {
        const deaccessionId = await createDeaccession({
          organizationId,
          collectionId,
          dateDeaccessioned: date.getTime(),
          reason: reason.trim(),
          method: "destruction",
          targetCollectionStatus: "deleted",
          notes: notes.trim() || undefined,
        });
        resetForm();
        onOpenChange(false);
        router.push(`/deaccessions/${deaccessionId}`);
      } else if (removalType === "move") {
        const requestId = await createMoveRequest({
          collectionId,
          targetOrganizationId: targetOrganizationId as Id<"organizations">,
          accessionMode,
          requestedAccessionNumber:
            accessionMode === "manual"
              ? manualAccessionNumber.trim()
              : undefined,
          reason: reason.trim(),
          notes: notes.trim() || undefined,
        });
        resetForm();
        onOpenChange(false);
        router.push(`/objects/move-requests/${requestId}`);
      }
    } catch (err) {
      console.error("Failed to process object removal or transfer:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to process object removal or transfer",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const blockers = moveEligibility?.blockers ?? [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Deaccession Object</DialogTitle>
          <DialogDescription>
            Choose how to deaccession {collectionTitle}.
          </DialogDescription>
        </DialogHeader>

        {!removalType && (
          <div className="grid gap-4 py-4">
            <button
              type="button"
              onClick={() => setRemovalType("sold")}
              className="flex items-start gap-4 rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted/50"
            >
              <div className="rounded-full bg-green-500/10 p-2">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Object Sold</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Record the sale of this object. Enter details about the
                  transaction including buyer information and sale price.
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
              onClick={() => setRemovalType("move")}
              className="flex items-start gap-4 rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted/50"
            >
              <div className="rounded-full bg-blue-500/10 p-2">
                <ArrowRightLeft className="h-5 w-5 text-blue-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Move to Another Organization</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Request approval to transfer this object to another
                  organization you belong to. You can keep the current accession
                  number or assign a new one.
                </p>
                <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                  Requires administrator approval before the move is executed
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setRemovalType("archived")}
              className="flex items-start gap-4 rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted/50"
            >
              <div className="rounded-full bg-amber-500/10 p-2">
                <Archive className="h-5 w-5 text-amber-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Archive Object</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Remove from the active collection but preserve all data,
                  history, and media. The object can be restored later.
                </p>
                <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                  Submitted to deaccession approval before the object is
                  archived
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setRemovalType("deleted")}
              className="flex items-start gap-4 rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted/50"
            >
              <div className="rounded-full bg-red-500/10 p-2">
                <Trash2 className="h-5 w-5 text-red-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Delete Object</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Hide this object from the main catalog. Use this if it was
                  added incorrectly or is a duplicate.
                </p>
                <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                  Submitted to deaccession approval before the object is deleted
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
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
                <div className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
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

            {!deaccessionWorkflow && workflowConfigs !== undefined && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
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
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(selectedDate) =>
                      selectedDate && setDate(selectedDate)
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
                onChange={(event) => setReason(event.target.value)}
                placeholder="Describe why this object is being sold..."
                rows={3}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="method">Sale Method *</Label>
              <Select
                value={method}
                onValueChange={(value) => setMethod(value as typeof method)}
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
                onChange={(event) => setDisposition(event.target.value)}
                placeholder="Buyer name, sale price, auction house..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Any additional comments..."
                rows={2}
              />
            </div>
          </div>
        )}

        {removalType === "move" && (
          <div className="space-y-4 py-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRemovalType(null)}
              className="mb-2"
            >
              ← Back to options
            </Button>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
              <div className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900 dark:text-blue-100">
                    Administrator Approval Required
                  </p>
                  <p className="mt-1 text-blue-700 dark:text-blue-300">
                    The object will remain in its current organization until a
                    source organization administrator approves the move.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="target-organization">
                Destination Organization *
              </Label>
              <Select
                value={targetOrganizationId || undefined}
                onValueChange={(value) =>
                  setTargetOrganizationId(value as Id<"organizations">)
                }
              >
                <SelectTrigger id="target-organization">
                  <SelectValue placeholder="Select destination organization" />
                </SelectTrigger>
                <SelectContent>
                  {(targetOrganizations ?? []).map((organization) => (
                    <SelectItem key={organization._id} value={organization._id}>
                      {organization.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {targetOrganizations !== undefined &&
                targetOrganizations.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    There are no eligible destination organizations available
                    for your account.
                  </p>
                )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="move-reason">Reason for Move *</Label>
              <Textarea
                id="move-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explain why this object should be moved to another organization..."
                rows={4}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="accession-mode">
                Accession Number Handling *
              </Label>
              <Select
                value={accessionMode}
                onValueChange={(value) =>
                  setAccessionMode(value as AccessionMode)
                }
              >
                <SelectTrigger id="accession-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keep">
                    Keep current accession number
                  </SelectItem>
                  <SelectItem value="auto">
                    Generate a new accession number
                  </SelectItem>
                  <SelectItem value="manual">
                    Enter a new accession number manually
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                If you assign a new accession number, the current one will be
                stored in Alternate Accession Numbers.
              </p>
            </div>

            {accessionMode === "manual" && (
              <div className="space-y-2">
                <Label htmlFor="manual-accession-number">
                  New Accession Number *
                </Label>
                <Input
                  id="manual-accession-number"
                  value={manualAccessionNumber}
                  onChange={(event) =>
                    setManualAccessionNumber(event.target.value)
                  }
                  placeholder="Enter the new accession number"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="move-notes">Additional Notes</Label>
              <Textarea
                id="move-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Add any context for the reviewing administrator..."
                rows={3}
              />
            </div>

            {blockers.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="space-y-2 text-sm">
                    <p className="font-medium text-amber-900 dark:text-amber-100">
                      This object cannot be moved yet
                    </p>
                    <ul className="list-disc space-y-1 pl-4 text-amber-700 dark:text-amber-300">
                      {blockers.map((blocker) => (
                        <li key={blocker.code}>{blocker.message}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
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

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
              <div className="flex items-start gap-3">
                <Archive className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="text-sm">
                  <p className="font-medium text-amber-900 dark:text-amber-100">
                    Archiving Object
                  </p>
                  <p className="mt-1 text-amber-700 dark:text-amber-300">
                    This object will be sent to Deaccessions for approval before
                    it is archived. Once approved, all data, history, and media
                    will be preserved and the object can be restored later.
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
                onChange={(event) => setReason(event.target.value)}
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

            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
              <div className="flex items-start gap-3">
                <Trash2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
                <div className="text-sm">
                  <p className="font-medium text-red-900 dark:text-red-100">
                    Deleting Object
                  </p>
                  <p className="mt-1 text-red-700 dark:text-red-300">
                    This object will be sent to Deaccessions for approval before
                    it is marked as deleted and hidden from the Objects catalog.
                    Use this if the object was added incorrectly or is a
                    duplicate.
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
                onChange={(event) => setReason(event.target.value)}
                placeholder="Enter reason for deleting this object (for example, duplicate entry or added in error)..."
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
              disabled={
                isSubmitting ||
                !reason.trim() ||
                (removalType === "move" &&
                  (!targetOrganizationId ||
                    (moveEligibility !== undefined &&
                      !moveEligibility.isEligible) ||
                    (accessionMode === "manual" &&
                      !manualAccessionNumber.trim())))
              }
              variant={removalType === "deleted" ? "destructive" : "default"}
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {removalType === "sold" && "Submit for Approval"}
              {removalType === "move" && "Submit Move Request"}
              {removalType === "archived" && "Submit Archive Request"}
              {removalType === "deleted" && "Submit Delete Request"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
