"use client";

import type { CollectionModuleId } from "@v1/backend/convex/utils/moduleCatalog";
import { useI18n } from "@/locales/client";
import { EditSection } from "../../collection-form-shared/edit-section";
import type {
  CollectionFormData,
  UpdateCollectionFormField,
} from "../../collection-form-shared/types";
import { TypeDetailsEditor } from "../../object-type-details/type-details-editor";
import { useTypeDetailFieldSpecs } from "../../object-type-details/use-type-detail-field-specs";

interface ObjectRequestTypeDetailsTabProps {
  collectionType: CollectionModuleId;
  formData: CollectionFormData;
  updateField: UpdateCollectionFormField;
}

export function ObjectRequestTypeDetailsTab({
  collectionType,
  formData,
  updateField,
}: ObjectRequestTypeDetailsTabProps) {
  const t = useI18n();
  const { typeLabels } = useTypeDetailFieldSpecs();
  const fields =
    formData.typeDetails?.collectionType === collectionType
      ? formData.typeDetails.fields
      : {};

  return (
    <div className="space-y-8">
      <EditSection
        title={t("objectTypeDetails.section.title", {
          type: typeLabels[collectionType],
        })}
        description={t("objectTypeDetails.section.description")}
      >
        <TypeDetailsEditor
          collectionType={collectionType}
          fields={fields}
          onChange={(nextFields) =>
            updateField("typeDetails", { collectionType, fields: nextFields })
          }
        />
      </EditSection>
    </div>
  );
}
