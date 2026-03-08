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
import { getAvailableParentLocationOptions } from "../location-parent-options";

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
  const t = useScopedI18n("locations.move");
  const tForm = useScopedI18n("locations.form");
  const tPlaceholders = useScopedI18n("locations.placeholders");
  const tCommon = useScopedI18n("common");
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
      setError(err instanceof Error ? err.message : t("moveFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableLocations = getAvailableParentLocationOptions(
    allLocations,
    locationId as Id<"locations">,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>
              {t("description", { name: locationName })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {error && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="parent">{t("selectDestination")} *</Label>
              <Select
                value={newParentId}
                onValueChange={setNewParentId}
                required
              >
                <SelectTrigger id="parent">
                  <SelectValue
                    placeholder={t("selectDestinationPlaceholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">
                    <span className="font-medium">{t("rootOption")}</span>
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
                  {t("currentParentDisabled")}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">{tForm("notesLabel")}</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={tPlaceholders("notesPlaceholder")}
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
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("moving") : t("moveLocation")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
