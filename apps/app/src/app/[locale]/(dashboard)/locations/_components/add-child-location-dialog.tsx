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
import { Image as ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

const LOCATION_IMAGE_CUSTOM_FIELD = "locationImageId";

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
  const [locationImageId, setLocationImageId] = useState<string | null>(null);
  const [locationImagePreviewUrl, setLocationImagePreviewUrl] = useState<
    string | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createLocation = useMutation(api.locations.create);
  const generateUploadUrl = useMutation(api.users.generateUploadUrl);

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

  useEffect(() => {
    return () => {
      if (locationImagePreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(locationImagePreviewUrl);
      }
    };
  }, [locationImagePreviewUrl]);

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
      customFields[LOCATION_IMAGE_CUSTOM_FIELD] = locationImageId;

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
      setLocationImageId(null);
      setLocationImagePreviewUrl(null);
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.createFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLocationImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsUploadingImage(true);
    setError(null);

    const nextPreviewUrl = URL.createObjectURL(file);
    setLocationImagePreviewUrl((previousPreviewUrl) => {
      if (previousPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previousPreviewUrl);
      }
      return nextPreviewUrl;
    });

    try {
      const uploadUrl = await generateUploadUrl({ mimeType: file.type });
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!response.ok) {
        throw new Error("Failed to upload location image");
      }

      const { storageId } = (await response.json()) as {
        storageId?: Id<"_storage">;
      };

      if (!storageId) {
        throw new Error("No storage ID returned for uploaded image");
      }

      setLocationImageId(storageId);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Failed to upload location image",
      );
      URL.revokeObjectURL(nextPreviewUrl);
      setLocationImagePreviewUrl(null);
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[min(96vw,960px)] overflow-y-auto sm:max-w-[960px]">
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
          <div className="grid gap-4 py-4 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] lg:items-start">
            {error && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive lg:col-span-2">
                {error}
              </div>
            )}
            <>
              <div className="grid gap-4">
                <div className="grid gap-4 xl:grid-cols-2">
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
                </div>

                <div className="space-y-3">
                  <Label>{t("unitCountsLabel")}</Label>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                            onChange={(e) =>
                              setterByKey[field.key](e.target.value)
                            }
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

              <div className="space-y-2">
                <Label>{t("locationPhotoLabel")}</Label>
                <div className="overflow-hidden rounded-xl border border-border/60 bg-secondary/20">
                  <div className="relative aspect-[16/9] bg-muted/30">
                    {locationImagePreviewUrl ? (
                      <img
                        src={locationImagePreviewUrl}
                        alt={name || "Location photo"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                        <ImageIcon className="h-8 w-8" />
                        <span className="text-sm">
                          {t("locationPhotoEmpty")}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-4 py-3">
                    <p className="text-xs text-muted-foreground">
                      {t("locationPhotoHint")}
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={handleLocationImageUpload}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingImage}
                      >
                        {isUploadingImage ? (
                          <Loader2 className="mr-2 size-4 animate-spin" />
                        ) : (
                          <Upload className="mr-2 h-4 w-4" />
                        )}
                        {locationImageId
                          ? t("replaceLocationPhoto")
                          : t("uploadLocationPhoto")}
                      </Button>
                      {locationImageId ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            if (locationImagePreviewUrl?.startsWith("blob:")) {
                              URL.revokeObjectURL(locationImagePreviewUrl);
                            }
                            setLocationImagePreviewUrl(null);
                            setLocationImageId(null);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t("removeLocationPhoto")}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </>
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
