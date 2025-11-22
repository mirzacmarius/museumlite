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
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Textarea } from "@v1/ui/textarea";
import { useMutation } from "convex/react";
import { useEffect, useState } from "react";

interface AddChildLocationDialogProps {
  parentLocationId?: string;
  parentLocationName?: string;
  parentLocationType?: string;
  parentLocationAddress?: string;
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const LOCATION_TYPES = [
  "Building",
  "Room",
  "Gallery",
  "Storage",
  "Cabinet",
  "Shelf",
  "Vault",
  "Other",
];

export function AddChildLocationDialog({
  parentLocationId,
  parentLocationName,
  parentLocationType,
  parentLocationAddress,
  organizationId,
  open,
  onOpenChange,
  onSuccess,
}: AddChildLocationDialogProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createLocation = useMutation(api.locations.create);

  // Autofill fields when dialog opens with parent location data
  useEffect(() => {
    if (open && parentLocationId) {
      // Inherit type from parent (user can change if needed)
      setType(parentLocationType || "");
      // Inherit address from parent
      setAddress(parentLocationAddress || "");
    } else if (open && !parentLocationId) {
      // Reset for root locations
      setType("");
      setAddress("");
    }
  }, [open, parentLocationId, parentLocationType, parentLocationAddress]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Please enter a location name");
      return;
    }

    if (!type) {
      setError("Please select a location type");
      return;
    }

    setIsSubmitting(true);
    try {
      await createLocation({
        organizationId: organizationId as Id<"organizations">,
        name: name.trim(),
        type,
        parentLocationId: parentLocationId
          ? (parentLocationId as Id<"locations">)
          : undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      // Reset form
      setName("");
      setType("");
      setAddress("");
      setNotes("");
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create location",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {parentLocationId ? "Add Child Location" : "Add Root Location"}
            </DialogTitle>
            <DialogDescription>
              {parentLocationId ? (
                <>
                  Create a new location under{" "}
                  <span className="font-medium">{parentLocationName}</span>
                </>
              ) : (
                "Create a new root-level location"
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {error && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., East Wing, Drawer 3"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type *</Label>
              <Select value={type} onValueChange={setType} required>
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select a type" />
                </SelectTrigger>
                <SelectContent>
                  {LOCATION_TYPES.map((locationType) => (
                    <SelectItem key={locationType} value={locationType}>
                      {locationType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Physical address (optional)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Location"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
