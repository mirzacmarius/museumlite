"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Input } from "@v1/ui/input";
import { useOrganization } from "@/components/organization-provider";
import { useQuery, useMutation } from "convex/react";
import { useState } from "react";
import type { Id } from "@v1/backend/convex/_generated/dataModel";

interface MoveObjectDialogProps {
  collectionId: string;
  currentLocationId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function MoveObjectDialog({
  collectionId,
  currentLocationId,
  open,
  onOpenChange,
  onSuccess,
}: MoveObjectDialogProps) {
  const { currentOrganizationId } = useOrganization();
  const [toLocationId, setToLocationId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const rootLocations = useQuery(
    api.locations.list,
    currentOrganizationId
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          parentLocationId: "root",
        }
      : "skip",
  );

  const moveObject = useMutation(api.locations.moveObject);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toLocationId) {
      alert("Please select a location");
      return;
    }

    setIsSubmitting(true);
    try {
      await moveObject({
        collectionId: collectionId as Id<"collections">,
        toLocationId: toLocationId as Id<"locations">,
        reason: reason || undefined,
        notes: notes || undefined,
      });
      onOpenChange(false);
      setToLocationId("");
      setReason("");
      setNotes("");
      onSuccess?.();
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Failed to move object",
      );
      setIsSubmitting(false);
    }
  };

  // Flatten locations recursively for selection
  const flattenLocations = (
    locs: typeof rootLocations,
    parent: string = "",
  ): Array<{ id: string; name: string; type: string }> => {
    if (!locs) return [];
    const result: Array<{ id: string; name: string; type: string }> = [];
    for (const loc of locs) {
      const displayName = parent ? `${parent} → ${loc.name}` : loc.name;
      result.push({ id: loc._id, name: displayName, type: loc.type });
      if (loc.children && loc.children.length > 0) {
        // Fetch children for this location
        const childList = loc.children.map((c) => ({
          _id: c._id,
          name: c.name,
          type: c.type,
          children: undefined,
        }));
        result.push(
          ...flattenLocations(childList as any, displayName),
        );
      }
    }
    return result;
  };

  const availableLocations = flattenLocations(rootLocations).filter(
    (loc) => loc.id !== currentLocationId,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Move Object</DialogTitle>
            <DialogDescription>
              Move this object to a different location. This will create a
              location history entry.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="location" className="text-sm font-medium">
                Destination Location *
              </label>
              <Select value={toLocationId} onValueChange={setToLocationId} required>
                <SelectTrigger id="location">
                  <SelectValue placeholder="Select a location" />
                </SelectTrigger>
                <SelectContent>
                  {availableLocations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name} ({loc.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label htmlFor="reason" className="text-sm font-medium">
                Reason
              </label>
              <Input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Loan, Exhibition, Conservation"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="notes" className="text-sm font-medium">
                Notes
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes about this move..."
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Moving..." : "Move Object"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

