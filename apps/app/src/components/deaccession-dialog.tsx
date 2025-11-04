"use client";

import { useMutation } from "convex/react";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Button } from "@v1/ui/button";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Calendar } from "@v1/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@v1/ui/utils";

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
            Remove "{collectionTitle}" from the collection. This action requires
            approval.
          </DialogDescription>
        </DialogHeader>

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
              onValueChange={(v) =>
                setMethod(v as typeof method)
              }
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
                  Transfer - Transferred within organization or to related entity
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
