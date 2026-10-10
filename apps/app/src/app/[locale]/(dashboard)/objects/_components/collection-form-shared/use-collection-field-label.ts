"use client";

import { useCallback } from "react";
import { useI18n } from "@/locales/client";

/** Translated names of catalog form fields, for notices and error summaries. */
export function useCollectionFieldLabel() {
  const t = useI18n();
  return useCallback(
    (field: string): string => {
      switch (field) {
        case "title":
          return t("objects.form.title");
        case "alternativeTitle":
          return t("recordForm.objectFields.alternativeTitle");
        case "accessionNumber":
          return t("objects.form.accessionNumber");
        case "alternateAccessionNumbers":
          return t("objects.form.alternateAccessionNumbers");
        case "objectName":
          return t("objects.form.objectName");
        case "objectType":
          return t("objects.printView.objectType");
        case "creator":
          return t("objects.form.creator");
        case "culture":
          return t("objects.form.culture");
        case "period":
          return t("objects.form.period");
        case "dateCreated":
          return t("objects.form.dateCreated");
        case "materials":
          return t("objects.form.materials");
        case "technique":
          return t("objects.printView.technique");
        case "dimensions":
          return t("objects.form.dimensions");
        case "dimensionHeight":
          return t("recordForm.objectFields.height");
        case "dimensionWidth":
          return t("recordForm.objectFields.width");
        case "dimensionDepth":
          return t("recordForm.objectFields.depth");
        case "dimensionUnit":
          return t("recordForm.objectFields.dimensionUnit");
        case "dimensionDiameter":
          return t("objects.printView.diameter");
        case "dimensionWeight":
          return t("objects.printView.weight");
        case "weightUnit":
          return t("recordForm.objectFields.weightUnit");
        case "description":
          return t("objects.form.description");
        case "condition":
          return t("objects.form.condition");
        case "conditionChangeNote":
          return t("untranslatedRecords.objects.form.conditionChangeNote");
        case "inscriptions":
          return t("objects.printView.inscriptions");
        case "inscriptionMarks":
          return t("recordForm.objectFields.inscriptionMarks");
        case "tags":
          return t("objects.printView.tags");
        case "provenance":
          return t("objects.form.provenance");
        case "exhibitionHistory":
          return t("objects.form.exhibitionHistory");
        case "ownershipHistory":
          return t("objects.printView.ownershipHistory");
        case "donated_by":
          return t("objects.form.donatedBy");
        case "donated_date":
          return t("objects.form.donatedDate");
        case "donation_info":
          return t("objects.form.donationInfo");
        case "acquisitionMethod":
          return t("objects.printView.acquisitionMethod");
        case "creditLine":
          return t("objects.printView.creditLine");
        case "legalRestrictions":
          return t("recordForm.objectFields.legalRestrictions");
        case "previous_owners":
          return t("objects.form.previousOwners");
        case "links":
          return t("objects.form.links");
        case "parentObjectId":
          return t("objects.form.parentObject");
        case "currentLocationId":
          return t("objects.form.currentLocation");
        case "collectionGroupId":
        case "collectionGroupIds":
          return t("objects.form.collectionGroup");
        case "collectionType":
          return t("objects.form.collectionType");
        case "typeDetails":
          return t("recordForm.objectFields.typeDetails");
        case "displayStatus":
          return t("objects.filters.onDisplay");
        case "isPubliclyVisible":
          return t("objects.printPreview.publicVisibility");
        case "isHighResDownloadable":
          return t("recordForm.objectFields.isHighResDownloadable");
        case "isSearchable":
          return t("objects.form.searchable");
        case "isValuationVisible":
          return t("untranslatedRecords.objects.form.valuationVisibility");
        case "publicSlug":
          return t("objects.form.publicUrlSlug");
        case "draftMedia":
          return t("recordForm.objectFields.draftMedia");
        default:
          return field;
      }
    },
    [t],
  );
}
