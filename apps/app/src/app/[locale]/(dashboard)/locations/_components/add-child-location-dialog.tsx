"use client";

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
import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import {
  LOCATION_UNIT_COUNT_FIELDS,
  hasCustomFieldValues,
  setOptionalNumberCustomField,
} from "../location-custom-fields";

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

const LOCATION_TYPE_KEYS = [
  "building",
  "room",
  "gallery",
  "storage",
  "cabinet",
  "shelf",
  "vault",
  "other",
] as const;

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
  const t = useScopedI18n("locations.form");
  const tCommon = useScopedI18n("common");
  const [name, setName] = useState("");
  const [locationCode, setLocationCode] = useState("");
  const [type, setType] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [capacity, setCapacity] = useState<string>("");
  const [vitrineCount, setVitrineCount] = useState("");
  const [wallCount, setWallCount] = useState("");
  const [wallItemsPerWall, setWallItemsPerWall] = useState("");
  const [cabinetCount, setCabinetCount] = useState("");
  const [shelfCount, setShelfCount] = useState("");
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
      setError(t("errors.nameRequired"));
      return;
    }

    if (!type) {
      setError(t("errors.typeRequired"));
      return;
    }

    if (!locationCode.trim()) {
      setError(t("errors.locationIdRequired"));
      return;
    }

    if (locationCode.trim().length > 50) {
      setError(t("errors.locationIdTooLong"));
      return;
    }

    setIsSubmitting(true);
    try {
      const customFields: Record<
        string,
        string | number | boolean | string[] | null
      > = {};

      setOptionalNumberCustomField(customFields, "vitrineCount", vitrineCount);
      setOptionalNumberCustomField(customFields, "wallCount", wallCount);
      setOptionalNumberCustomField(
        customFields,
        "wallItemsPerWall",
        wallItemsPerWall,
      );
      setOptionalNumberCustomField(customFields, "cabinetCount", cabinetCount);
      setOptionalNumberCustomField(customFields, "shelfCount", shelfCount);

      await createLocation({
        organizationId: organizationId as Id<"organizations">,
        name: name.trim(),
        locationCode: locationCode.trim(),
        type,
        parentLocationId: parentLocationId
          ? (parentLocationId as Id<"locations">)
          : undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
        capacity: capacity ? Number.parseInt(capacity, 10) : undefined,
        customFields: hasCustomFieldValues(customFields)
          ? customFields
          : undefined,
      });

      setName("");
      setLocationCode("");
      setType("");
      setAddress("");
      setNotes("");
      setCapacity("");
      setVitrineCount("");
      setWallCount("");
      setWallItemsPerWall("");
      setCabinetCount("");
      setShelfCount("");
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.createFailed"));
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
              {parentLocationId ? t("addChildLocation") : t("addRootLocation")}
            </DialogTitle>
            <DialogDescription>
              {parentLocationId ? (
                <>
                  {t("createUnder")}{" "}
                  <span className="font-medium">{parentLocationName}</span>
                </>
              ) : (
                t("createRootLevel")
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
              <Label htmlFor="name">{t("nameLabel")}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="locationCode">{t("locationIdLabel")}</Label>
              <Input
                id="locationCode"
                value={locationCode}
                onChange={(e) => setLocationCode(e.target.value)}
                placeholder={t("locationIdPlaceholder")}
                required
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">{t("typeLabel")}</Label>
              <Select
                value={type.toLowerCase()}
                onValueChange={(val) =>
                  setType(val.charAt(0).toUpperCase() + val.slice(1))
                }
                required
              >
                <SelectTrigger id="type">
                  <SelectValue placeholder={t("typePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {LOCATION_TYPE_KEYS.map((typeKey) => (
                    <SelectItem key={typeKey} value={typeKey}>
                      {t(`locationTypes.${typeKey}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">{t("addressLabel")}</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t("addressPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="capacity">{t("capacityLabel")}</Label>
              <Input
                id="capacity"
                type="number"
                min="0"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder={t("capacityPlaceholder")}
              />
            </div>
            <div className="space-y-3">
              <Label>{t("unitCountsLabel")}</Label>
              <div className="grid grid-cols-2 gap-3">
                {LOCATION_UNIT_COUNT_FIELDS.map((field) => {
                  const valueByKey = {
                    vitrineCount,
                    wallCount,
                    cabinetCount,
                    shelfCount,
                  };
                  const setterByKey = {
                    vitrineCount: setVitrineCount,
                    wallCount: setWallCount,
                    cabinetCount: setCabinetCount,
                    shelfCount: setShelfCount,
                  };

                  return (
                    <div key={field.key} className="space-y-2">
                      <Label htmlFor={field.key}>{t(field.labelKey)}</Label>
                      <Input
                        id={field.key}
                        type="number"
                        min="0"
                        value={valueByKey[field.key]}
                        onChange={(e) => setterByKey[field.key](e.target.value)}
                        placeholder={t(field.placeholderKey)}
                      />
                    </div>
                  );
                })}
                <div className="space-y-2">
                  <Label htmlFor="wallItemsPerWall">
                    {t("wallItemsPerWallLabel")}
                  </Label>
                  <Input
                    id="wallItemsPerWall"
                    type="number"
                    min="1"
                    value={wallItemsPerWall}
                    onChange={(e) => setWallItemsPerWall(e.target.value)}
                    placeholder={t("wallItemsPerWallPlaceholder")}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">{t("notesLabel")}</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("notesPlaceholder")}
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
              {isSubmitting ? t("creating") : t("createLocation")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
