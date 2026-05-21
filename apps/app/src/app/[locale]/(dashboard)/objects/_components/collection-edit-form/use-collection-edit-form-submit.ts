"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import type React from "react";
import { useCallback, useState } from "react";
import { serializeStringListField } from "@/lib/string-list-field";
import type { CollectionFormData } from "../collection-form-shared/types";
import {
  getFormSignature,
  parseOptionalWeight,
} from "../collection-form-shared/utils";

interface UseCollectionEditFormSubmitOptions {
  collectionId: string;
  typedCollectionId: Id<"collections">;
  formData: CollectionFormData;
  initialFormSignatureRef: React.MutableRefObject<string>;
  isFormDirty: boolean;
  hasMediaChanges: boolean;
  hasConditionChanged: boolean;
  requiresConditionChangeNote: boolean;
  conditionChangeNote: string;
  setError: (error: string | null) => void;
  t: (key: string) => string;
}

export function useCollectionEditFormSubmit({
  collectionId,
  typedCollectionId,
  formData,
  initialFormSignatureRef,
  isFormDirty,
  hasMediaChanges,
  hasConditionChanged,
  requiresConditionChangeNote,
  conditionChangeNote,
  setError,
  t,
}: UseCollectionEditFormSubmitOptions) {
  const { push } = useRouter();
  const updateCollection = useMutation(api.collections.update);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canUpdateObject = isFormDirty || hasMediaChanges;

  const saveRecord = useCallback(async () => {
    if (!formData.title.trim()) {
      setError(t("form.errors.titleRequired"));
      return false;
    }

    const parsedDimensionWeight = parseOptionalWeight(formData.dimensionWeight);
    if (!parsedDimensionWeight.isValid) {
      setError(
        "Weight must be a valid non-negative number with an optional unit.",
      );
      return false;
    }

    if (requiresConditionChangeNote && !conditionChangeNote.trim()) {
      setError(
        "Condition change note is required when updating the condition.",
      );
      return false;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const materialsString = serializeStringListField(formData.materials);
      const objectTypeString = Array.isArray(formData.objectType)
        ? JSON.stringify(formData.objectType)
        : formData.objectType;

      await updateCollection({
        collectionId: typedCollectionId,
        ...formData,
        materials: materialsString,
        objectType: objectTypeString,
        dimensions: formData.dimensions?.trim() || "",
        dimensionDiameter: formData.dimensionDiameter?.trim() || "",
        dimensionWeight: parsedDimensionWeight.value ?? null,
        weightUnit:
          parsedDimensionWeight.value === undefined
            ? ""
            : parsedDimensionWeight.unit || formData.weightUnit?.trim() || "",
        links: formData.links?.flatMap(({ localId: _localId, ...entry }) =>
          entry.url.trim() !== "" ? [entry] : [],
        ),
        parentObjectId: formData.parentObjectId
          ? (formData.parentObjectId as Id<"collections">)
          : undefined,
        currentLocationId:
          formData.currentLocationId &&
          formData.currentLocationId !== "__none__"
            ? (formData.currentLocationId as Id<"locations">)
            : undefined,
        collectionGroupId: formData.collectionGroupIds?.[0]
          ? (formData.collectionGroupIds[0] as Id<"collectionGroups">)
          : undefined,
        collectionGroupIds: formData.collectionGroupIds?.flatMap(
          (collectionGroupId) =>
            collectionGroupId
              ? [collectionGroupId as Id<"collectionGroups">]
              : [],
        ),
        conditionChangeNote: hasConditionChanged
          ? conditionChangeNote.trim() || undefined
          : undefined,
        alternateAccessionNumbers: formData.alternateAccessionNumbers,
        ownershipHistory: formData.ownershipHistory?.map(
          ({ localId: _localId, ...entry }) => entry,
        ),
      });

      initialFormSignatureRef.current = getFormSignature(formData);
      return true;
    } catch (err) {
      console.error("Error updating collection:", err);
      setError(
        err instanceof Error ? err.message : t("form.errors.updateFailed"),
      );
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [
    conditionChangeNote,
    formData,
    hasConditionChanged,
    initialFormSignatureRef,
    requiresConditionChangeNote,
    setError,
    t,
    typedCollectionId,
    updateCollection,
  ]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!isFormDirty && hasMediaChanges) {
        push(`/objects/${collectionId}`);
        return;
      }

      if (await saveRecord()) {
        push(`/objects/${collectionId}`);
      }
    },
    [collectionId, hasMediaChanges, isFormDirty, push, saveRecord],
  );

  return {
    isSubmitting,
    canUpdateObject,
    saveRecord,
    handleSubmit,
    push,
  };
}
