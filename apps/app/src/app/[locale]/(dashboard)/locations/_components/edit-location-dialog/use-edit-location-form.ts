"use client";

import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import {
  getNumericCustomFieldValue,
  setOptionalNumberCustomField,
} from "../../location-custom-fields";
import { getAvailableParentLocationOptions } from "../../location-parent-options";
import { LOCATION_IMAGE_CUSTOM_FIELD } from "../location-form-shared";

export function useEditLocationForm(
  locationId: string,
  open: boolean,
  onOpenChange: (open: boolean) => void,
) {
  const t = useScopedI18n("locations.form");
  const { currentOrganizationId } = useOrganization();
  const [name, setName] = useState("");
  const [locationCode, setLocationCode] = useState("");
  const [type, setType] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [parentLocationId, setParentLocationId] = useState("root");
  const [capacity, setCapacity] = useState<string>("");
  const [temperature, setTemperature] = useState<string>("");
  const [humidity, setHumidity] = useState<string>("");
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

  const location = useQuery(
    api.locations.get,
    open && locationId ? { locationId: locationId as Id<"locations"> } : "skip",
  );
  const allLocations = useQuery(
    api.locations.listAll,
    open && currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const updateLocation = useMutation(api.locations.update);
  const generateUploadUrl = useMutation(api.users.generateUploadUrl);

  useEffect(() => {
    if (!location) return;

    setName(location.name);
    setLocationCode(location.locationCode);
    setType(location.type);
    setAddress(location.address || "");
    setNotes(location.notes || "");
    setParentLocationId(location.parentLocationId ?? "root");
    setCapacity(location.capacity?.toString() || "");
    setTemperature(
      getNumericCustomFieldValue(location.customFields, "temperature"),
    );
    setHumidity(getNumericCustomFieldValue(location.customFields, "humidity"));
    setVitrineCount(
      getNumericCustomFieldValue(location.customFields, "vitrineCount"),
    );
    setWallCount(
      getNumericCustomFieldValue(location.customFields, "wallCount"),
    );
    setWallItemsPerWall(
      getNumericCustomFieldValue(location.customFields, "wallItemsPerWall"),
    );
    setCabinetCount(
      getNumericCustomFieldValue(location.customFields, "cabinetCount"),
    );
    setShelfCount(
      getNumericCustomFieldValue(location.customFields, "shelfCount"),
    );
    setLocationImageId(
      typeof location.customFields?.[LOCATION_IMAGE_CUSTOM_FIELD] === "string"
        ? location.customFields[LOCATION_IMAGE_CUSTOM_FIELD]
        : null,
    );
    setLocationImagePreviewUrl(null);
  }, [location]);

  useEffect(() => {
    return () => {
      if (locationImagePreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(locationImagePreviewUrl);
      }
    };
  }, [locationImagePreviewUrl]);

  const availableParentLocations =
    open && locationId
      ? getAvailableParentLocationOptions(
          allLocations,
          locationId as Id<"locations">,
        )
      : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location) return;
    setError(null);

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
      > = {
        ...((location.customFields || {}) as Record<
          string,
          string | number | boolean | string[] | null
        >),
      };
      setOptionalNumberCustomField(
        customFields,
        "temperature",
        temperature,
        Number.parseFloat,
      );
      setOptionalNumberCustomField(
        customFields,
        "humidity",
        humidity,
        Number.parseFloat,
      );
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

      await updateLocation({
        locationId: locationId as Id<"locations">,
        name,
        locationCode: locationCode.trim(),
        type,
        parentLocationId:
          parentLocationId === "root"
            ? undefined
            : (parentLocationId as Id<"locations">),
        address: address || undefined,
        notes: notes || undefined,
        capacity: capacity ? Number.parseInt(capacity, 10) : undefined,
        customFields,
      });
      onOpenChange(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : t("errors.createFailed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLocationImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

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

  const removeLocationImage = () => {
    if (locationImagePreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(locationImagePreviewUrl);
    }
    setLocationImagePreviewUrl(null);
    setLocationImageId(null);
  };

  const existingImageUrl =
    (location as { imageUrl?: string } | null)?.imageUrl ?? null;

  return {
    location,
    name,
    setName,
    locationCode,
    setLocationCode,
    type,
    setType,
    address,
    setAddress,
    notes,
    setNotes,
    parentLocationId,
    setParentLocationId,
    capacity,
    setCapacity,
    temperature,
    setTemperature,
    humidity,
    setHumidity,
    vitrineCount,
    setVitrineCount,
    wallCount,
    setWallCount,
    wallItemsPerWall,
    setWallItemsPerWall,
    cabinetCount,
    setCabinetCount,
    shelfCount,
    setShelfCount,
    locationImageId,
    locationImagePreviewUrl,
    existingImageUrl,
    isSubmitting,
    isUploadingImage,
    error,
    fileInputRef,
    availableParentLocations,
    handleSubmit,
    handleLocationImageUpload,
    removeLocationImage,
  };
}
