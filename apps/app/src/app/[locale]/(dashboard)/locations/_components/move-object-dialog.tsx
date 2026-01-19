"use client";

import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
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
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

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
  const t = useScopedI18n("locations.moveObject");
  const tForm = useScopedI18n("locations.form");
  const tCommon = useScopedI18n("common");
  const { currentOrganizationId } = useOrganization();
  const [toLocationId, setToLocationId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    if (!toLocationId) {
      setError("Please select a location");
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move object");
      setIsSubmitting(false);
    }
  };

  // Flatten locations recursively for selection
  const flattenLocations = (
    locs: typeof rootLocations,
    parent = "",
  ): Array<{ id: string; name: string; type: string }> => {
    if (!locs) return [];
    const result: Array<{ id: string; name: string; type: string }> = [];
    for (const loc of locs) {
      const displayName = parent ? `${parent} → ${loc.name}` : loc.name;
      result.push({ id: loc._id, name: displayName, type: loc.type });
      if (loc.children && loc.children.length > 0) {
        // Children are simplified, so we can process them directly
        // without recursion since they don't have nested children
        for (const child of loc.children) {
          const childDisplayName = `${displayName} → ${child.name}`;
          result.push({
            id: child._id,
            name: childDisplayName,
            type: child.type,
          });
        }
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
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {error && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="location">{t("selectDestination")} *</Label>
              <Select
                value={toLocationId}
                onValueChange={setToLocationId}
                required
              >
                <SelectTrigger id="location">
                  <SelectValue
                    placeholder={t("selectDestinationPlaceholder")}
                  />
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
              <Label htmlFor="reason">Reason</Label>
              <Input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Loan, Exhibition, Conservation"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">{tForm("notesLabel")}</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={tForm("notesPlaceholder")}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("moving") : t("moveObject")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
