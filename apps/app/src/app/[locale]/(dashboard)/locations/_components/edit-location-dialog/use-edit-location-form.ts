"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useReducer, useRef } from "react";
import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
import {
  getNumericCustomFieldValue,
  type LocationCustomFields,
  setOptionalNumberCustomField,
} from "../../location-custom-fields";
import { getAvailableParentLocationOptions } from "../../location-parent-options";
import { LOCATION_IMAGE_CUSTOM_FIELD } from "../location-form-shared/constants";

interface EditLocationFormState {
  name: string;
  locationCode: string;
  type: string;
  address: string;
  notes: string;
  parentLocationId: string;
  capacity: string;
  temperature: string;
  humidity: string;
  vitrineCount: string;
  wallCount: string;
  wallItemsPerWall: string;
  cabinetCount: string;
  shelfCount: string;
  locationImageId: string | null;
  locationImagePreviewUrl: string | null;
  isSubmitting: boolean;
  isUploadingImage: boolean;
  error: string | null;
}

const initialEditLocationFormState: EditLocationFormState = {
  name: "",
  locationCode: "",
  type: "",
  address: "",
  notes: "",
  parentLocationId: "root",
  capacity: "",
  temperature: "",
  humidity: "",
  vitrineCount: "",
  wallCount: "",
  wallItemsPerWall: "",
  cabinetCount: "",
  shelfCount: "",
  locationImageId: null,
  locationImagePreviewUrl: null,
  isSubmitting: false,
  isUploadingImage: false,
  error: null,
};

interface LocationHydrationSource {
  name: string;
  locationCode: string;
  type: string;
  address?: string;
  notes?: string;
  parentLocationId?: Id<"locations">;
  capacity?: number;
  customFields?: LocationCustomFields;
}

type EditLocationFormAction =
  | { type: "hydrate"; location: LocationHydrationSource }
  | { type: "setName"; value: string }
  | { type: "setLocationCode"; value: string }
  | { type: "setType"; value: string }
  | { type: "setAddress"; value: string }
  | { type: "setNotes"; value: string }
  | { type: "setParentLocationId"; value: string }
  | { type: "setCapacity"; value: string }
  | { type: "setTemperature"; value: string }
  | { type: "setHumidity"; value: string }
  | { type: "setVitrineCount"; value: string }
  | { type: "setWallCount"; value: string }
  | { type: "setWallItemsPerWall"; value: string }
  | { type: "setCabinetCount"; value: string }
  | { type: "setShelfCount"; value: string }
  | { type: "setLocationImageId"; value: string | null }
  | { type: "setLocationImagePreviewUrl"; value: string | null }
  | { type: "setIsSubmitting"; value: boolean }
  | { type: "setIsUploadingImage"; value: boolean }
  | { type: "setError"; value: string | null };

function editLocationFormReducer(
  state: EditLocationFormState,
  action: EditLocationFormAction,
): EditLocationFormState {
  switch (action.type) {
    case "hydrate":
      return {
        ...state,
        name: action.location.name,
        locationCode: action.location.locationCode,
        type: action.location.type,
        address: action.location.address || "",
        notes: action.location.notes || "",
        parentLocationId: action.location.parentLocationId ?? "root",
        capacity: action.location.capacity?.toString() || "",
        temperature: getNumericCustomFieldValue(
          action.location.customFields,
          "temperature",
        ),
        humidity: getNumericCustomFieldValue(
          action.location.customFields,
          "humidity",
        ),
        vitrineCount: getNumericCustomFieldValue(
          action.location.customFields,
          "vitrineCount",
        ),
        wallCount: getNumericCustomFieldValue(
          action.location.customFields,
          "wallCount",
        ),
        wallItemsPerWall: getNumericCustomFieldValue(
          action.location.customFields,
          "wallItemsPerWall",
        ),
        cabinetCount: getNumericCustomFieldValue(
          action.location.customFields,
          "cabinetCount",
        ),
        shelfCount: getNumericCustomFieldValue(
          action.location.customFields,
          "shelfCount",
        ),
        locationImageId:
          typeof action.location.customFields?.[LOCATION_IMAGE_CUSTOM_FIELD] ===
          "string"
            ? action.location.customFields[LOCATION_IMAGE_CUSTOM_FIELD]
            : null,
        locationImagePreviewUrl: null,
        error: null,
      };
    case "setName":
      return { ...state, name: action.value };
    case "setLocationCode":
      return { ...state, locationCode: action.value };
    case "setType":
      return { ...state, type: action.value };
    case "setAddress":
      return { ...state, address: action.value };
    case "setNotes":
      return { ...state, notes: action.value };
    case "setParentLocationId":
      return { ...state, parentLocationId: action.value };
    case "setCapacity":
      return { ...state, capacity: action.value };
    case "setTemperature":
      return { ...state, temperature: action.value };
    case "setHumidity":
      return { ...state, humidity: action.value };
    case "setVitrineCount":
      return { ...state, vitrineCount: action.value };
    case "setWallCount":
      return { ...state, wallCount: action.value };
    case "setWallItemsPerWall":
      return { ...state, wallItemsPerWall: action.value };
    case "setCabinetCount":
      return { ...state, cabinetCount: action.value };
    case "setShelfCount":
      return { ...state, shelfCount: action.value };
    case "setLocationImageId":
      return { ...state, locationImageId: action.value };
    case "setLocationImagePreviewUrl":
      return { ...state, locationImagePreviewUrl: action.value };
    case "setIsSubmitting":
      return { ...state, isSubmitting: action.value };
    case "setIsUploadingImage":
      return { ...state, isUploadingImage: action.value };
    case "setError":
      return { ...state, error: action.value };
  }
}

export function useEditLocationForm(
  locationId: string,
  open: boolean,
  onOpenChange: (open: boolean) => void,
) {
  const t = useScopedI18n("locations.form");
  const { currentOrganizationId } = useOrganization();
  const [state, dispatch] = useReducer(
    editLocationFormReducer,
    initialEditLocationFormState,
  );
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
    dispatch({ type: "hydrate", location });
  }, [location]);

  useEffect(() => {
    return () => {
      if (state.locationImagePreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(state.locationImagePreviewUrl);
      }
    };
  }, [state.locationImagePreviewUrl]);

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
    dispatch({ type: "setError", value: null });

    if (!state.locationCode.trim()) {
      dispatch({ type: "setError", value: t("errors.locationIdRequired") });
      return;
    }
    if (state.locationCode.trim().length > 50) {
      dispatch({ type: "setError", value: t("errors.locationIdTooLong") });
      return;
    }

    dispatch({ type: "setIsSubmitting", value: true });
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
        state.temperature,
        Number.parseFloat,
      );
      setOptionalNumberCustomField(
        customFields,
        "humidity",
        state.humidity,
        Number.parseFloat,
      );
      setOptionalNumberCustomField(
        customFields,
        "vitrineCount",
        state.vitrineCount,
      );
      setOptionalNumberCustomField(customFields, "wallCount", state.wallCount);
      setOptionalNumberCustomField(
        customFields,
        "wallItemsPerWall",
        state.wallItemsPerWall,
      );
      setOptionalNumberCustomField(
        customFields,
        "cabinetCount",
        state.cabinetCount,
      );
      setOptionalNumberCustomField(
        customFields,
        "shelfCount",
        state.shelfCount,
      );
      customFields[LOCATION_IMAGE_CUSTOM_FIELD] = state.locationImageId;

      await updateLocation({
        locationId: locationId as Id<"locations">,
        name: state.name,
        locationCode: state.locationCode.trim(),
        type: state.type,
        parentLocationId:
          state.parentLocationId === "root"
            ? undefined
            : (state.parentLocationId as Id<"locations">),
        address: state.address || undefined,
        notes: state.notes || undefined,
        capacity: state.capacity
          ? Number.parseInt(state.capacity, 10)
          : undefined,
        customFields,
      });
      onOpenChange(false);
    } catch (submitError) {
      dispatch({
        type: "setError",
        value:
          submitError instanceof Error
            ? submitError.message
            : t("errors.createFailed"),
      });
    } finally {
      dispatch({ type: "setIsSubmitting", value: false });
    }
  };

  const handleLocationImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    dispatch({ type: "setIsUploadingImage", value: true });
    dispatch({ type: "setError", value: null });

    const nextPreviewUrl = URL.createObjectURL(file);
    if (state.locationImagePreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(state.locationImagePreviewUrl);
    }
    dispatch({ type: "setLocationImagePreviewUrl", value: nextPreviewUrl });

    try {
      const uploadUrl = await generateUploadUrl({
        mimeType: file.type,
        organizationId: currentOrganizationId as Id<"organizations">,
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

      dispatch({ type: "setLocationImageId", value: storageId });
    } catch (uploadError) {
      dispatch({
        type: "setError",
        value:
          uploadError instanceof Error
            ? uploadError.message
            : "Failed to upload location image",
      });
      URL.revokeObjectURL(nextPreviewUrl);
      dispatch({ type: "setLocationImagePreviewUrl", value: null });
    } finally {
      dispatch({ type: "setIsUploadingImage", value: false });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeLocationImage = () => {
    if (state.locationImagePreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(state.locationImagePreviewUrl);
    }
    dispatch({ type: "setLocationImagePreviewUrl", value: null });
    dispatch({ type: "setLocationImageId", value: null });
  };

  const existingImageUrl =
    (location as { imageUrl?: string } | null)?.imageUrl ?? null;

  return {
    location,
    name: state.name,
    setName: (value: string) => dispatch({ type: "setName", value }),
    locationCode: state.locationCode,
    setLocationCode: (value: string) =>
      dispatch({ type: "setLocationCode", value }),
    type: state.type,
    setType: (value: string) => dispatch({ type: "setType", value }),
    address: state.address,
    setAddress: (value: string) => dispatch({ type: "setAddress", value }),
    notes: state.notes,
    setNotes: (value: string) => dispatch({ type: "setNotes", value }),
    parentLocationId: state.parentLocationId,
    setParentLocationId: (value: string) =>
      dispatch({ type: "setParentLocationId", value }),
    capacity: state.capacity,
    setCapacity: (value: string) => dispatch({ type: "setCapacity", value }),
    temperature: state.temperature,
    setTemperature: (value: string) =>
      dispatch({ type: "setTemperature", value }),
    humidity: state.humidity,
    setHumidity: (value: string) => dispatch({ type: "setHumidity", value }),
    vitrineCount: state.vitrineCount,
    setVitrineCount: (value: string) =>
      dispatch({ type: "setVitrineCount", value }),
    wallCount: state.wallCount,
    setWallCount: (value: string) => dispatch({ type: "setWallCount", value }),
    wallItemsPerWall: state.wallItemsPerWall,
    setWallItemsPerWall: (value: string) =>
      dispatch({ type: "setWallItemsPerWall", value }),
    cabinetCount: state.cabinetCount,
    setCabinetCount: (value: string) =>
      dispatch({ type: "setCabinetCount", value }),
    shelfCount: state.shelfCount,
    setShelfCount: (value: string) =>
      dispatch({ type: "setShelfCount", value }),
    locationImageId: state.locationImageId,
    locationImagePreviewUrl: state.locationImagePreviewUrl,
    existingImageUrl,
    isSubmitting: state.isSubmitting,
    isUploadingImage: state.isUploadingImage,
    error: state.error,
    fileInputRef,
    availableParentLocations,
    handleSubmit,
    handleLocationImageUpload,
    removeLocationImage,
  };
}
