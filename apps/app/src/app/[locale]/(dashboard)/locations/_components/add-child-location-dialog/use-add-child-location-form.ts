"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { useActionErrorMessage } from "@/hooks/use-action-error-message";
import { useScopedI18n } from "@/locales/client";
import {
  hasCustomFieldValues,
  setOptionalNumberCustomField,
} from "../../location-custom-fields";
import { LOCATION_IMAGE_CUSTOM_FIELD } from "../location-form-shared/constants";

interface UseAddChildLocationFormOptions {
  parentLocationId?: string;
  parentLocationType?: string;
  parentLocationAddress?: string;
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function useAddChildLocationForm({
  parentLocationId,
  parentLocationType,
  parentLocationAddress,
  organizationId,
  open,
  onOpenChange,
  onSuccess,
}: UseAddChildLocationFormOptions) {
  const t = useScopedI18n("locations.form");
  const actionErrorMessage = useActionErrorMessage();
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

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextType = parentLocationId ? parentLocationType || "" : "";
    const nextAddress = parentLocationId ? parentLocationAddress || "" : "";

    setType(nextType);
    setAddress(nextAddress);
  }, [open, parentLocationId, parentLocationType, parentLocationAddress]);

  useEffect(() => {
    return () => {
      if (locationImagePreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(locationImagePreviewUrl);
      }
    };
  }, [locationImagePreviewUrl]);

  const resetForm = () => {
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
  };

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

      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(actionErrorMessage(err, t("errors.createFailed")));
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
      const uploadUrl = await generateUploadUrl({
        mimeType: file.type,
        organizationId: organizationId as Id<"organizations">,
      });
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
    } catch {
      setError(t("imageUploadFailed"));
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

  return {
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
    capacity,
    setCapacity,
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
    isSubmitting,
    isUploadingImage,
    error,
    fileInputRef,
    handleSubmit,
    handleLocationImageUpload,
    removeLocationImage,
  };
}
