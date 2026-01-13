"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

interface BulkMoveLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: Id<"collections">[];
  organizationId: Id<"organizations">;
  onSuccess: () => void;
}

export function BulkMoveLocationDialog({
  open,
  onOpenChange,
  selectedIds,
  organizationId,
  onSuccess,
}: BulkMoveLocationDialogProps) {
  const [locationId, setLocationId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const locations = useQuery(api.locations.listAllWithPaths, {
    organizationId,
  });

  const bulkUpdateLocation = useMutation(api.collections.bulkUpdateLocation);

  const handleSubmit = async () => {
    if (!locationId) {
      toast.error("Please select a location");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await bulkUpdateLocation({
        collectionIds: selectedIds,
        locationId: locationId as Id<"locations">,
      });

      if (result.updated > 0) {
        toast.success(
          `Moved ${result.updated} item${result.updated !== 1 ? "s" : ""} to new location`,
        );
      }
      if (result.failed > 0) {
        toast.error(
          `Failed to move ${result.failed} item${result.failed !== 1 ? "s" : ""}`,
        );
      }

      onSuccess();
      onOpenChange(false);
      setLocationId("");
    } catch (error) {
      toast.error("Failed to move items");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move to Location</DialogTitle>
          <DialogDescription>
            Move {selectedIds.length} selected item
            {selectedIds.length !== 1 ? "s" : ""} to a new location.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="location">New Location</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger id="location">
                <SelectValue placeholder="Select a location" />
              </SelectTrigger>
              <SelectContent>
                {locations?.map((location) => (
                  <SelectItem key={location._id} value={location._id}>
                    {location.path.map((p) => p.name).join(" > ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !locationId}>
            {isSubmitting ? "Moving..." : "Move Items"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
