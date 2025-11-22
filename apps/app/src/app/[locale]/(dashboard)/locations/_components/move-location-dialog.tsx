"use client";

import { useOrganization } from "@/components/organization-provider";
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
import { Textarea } from "@v1/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

interface MoveLocationDialogProps {
  locationId: string;
  locationName: string;
  currentParentId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function MoveLocationDialog({
  locationId,
  locationName,
  currentParentId,
  open,
  onOpenChange,
  onSuccess,
}: MoveLocationDialogProps) {
  const { currentOrganizationId } = useOrganization();
  const [newParentId, setNewParentId] = useState<string>("root");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allLocations = useQuery(
    api.locations.listAll,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const updateLocation = useMutation(api.locations.update);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    setIsSubmitting(true);
    try {
      await updateLocation({
        locationId: locationId as Id<"locations">,
        parentLocationId:
          newParentId === "root" ? undefined : (newParentId as Id<"locations">),
        notes: notes.trim() || undefined,
      });

      setNewParentId("root");
      setNotes("");
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move location");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Flatten locations for selection, excluding current location and its descendants
  const flattenLocations = (
    locs: typeof allLocations,
  ): Array<{ id: string; name: string; type: string; level: number }> => {
    if (!locs) return [];
    const result: Array<{
      id: string;
      name: string;
      type: string;
      level: number;
    }> = [];

    // Helper to check if a location is a descendant of the current location
    const isDescendant = (loc: (typeof locs)[0]): boolean => {
      if (loc._id === locationId) return true;
      let current = loc.parentLocationId;
      while (current) {
        if (current === locationId) return true;
        const parent = locs.find((l) => l._id === current);
        current = parent?.parentLocationId;
      }
      return false;
    };

    // Build tree structure and flatten
    const processLocation = (loc: (typeof locs)[0], level = 0, prefix = "") => {
      if (isDescendant(loc)) return;

      const displayName = prefix ? `${prefix} → ${loc.name}` : loc.name;
      result.push({
        id: loc._id,
        name: displayName,
        type: loc.type,
        level,
      });

      // Find children
      const children = locs.filter((l) => l.parentLocationId === loc._id);
      for (const child of children) {
        processLocation(child, level + 1, displayName);
      }
    };

    // Process root locations first
    const roots = locs.filter((l) => !l.parentLocationId);
    for (const root of roots) {
      processLocation(root);
    }

    return result;
  };

  const availableLocations = flattenLocations(allLocations);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Move Location</DialogTitle>
            <DialogDescription>
              Move <span className="font-medium">{locationName}</span> to a new
              parent location
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {error && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="parent">New Parent Location *</Label>
              <Select
                value={newParentId}
                onValueChange={setNewParentId}
                required
              >
                <SelectTrigger id="parent">
                  <SelectValue placeholder="Select a parent location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">
                    <span className="font-medium">Root (No Parent)</span>
                  </SelectItem>
                  {availableLocations.map((loc) => (
                    <SelectItem
                      key={loc.id}
                      value={loc.id}
                      disabled={loc.id === currentParentId}
                    >
                      <span style={{ paddingLeft: `${loc.level * 12}px` }}>
                        {loc.name} ({loc.type})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentParentId && (
                <p className="text-xs text-muted-foreground">
                  Current parent is disabled in the list
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason for moving this location..."
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
              {isSubmitting ? "Moving..." : "Move Location"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
