"use client";

import { useI18n, useScopedI18n } from "@/locales/client";
import { CollectionEditFormLayout } from "./collection-edit-form-layout";
import { useCollectionEditForm } from "./use-collection-edit-form";
export function CollectionEditPage() {
  const tRoot = useI18n();
  const common = useScopedI18n("common");
  const form = useCollectionEditForm();

  if (!form.currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">
          {tRoot("untranslatedRecords.objects.edit.selectOrganization")}
        </p>
      </div>
    );
  }

  if (form.collection === undefined) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{common("loading")}</p>
      </div>
    );
  }

  if (form.collection === null) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">
          {tRoot("untranslatedRecords.objects.edit.collectionNotFound")}
        </p>
      </div>
    );
  }

  return (
    <CollectionEditFormLayout
      form={{
        ...form,
        collection: form.collection,
        currentOrganizationId: form.currentOrganizationId!,
      }}
    />
  );
}

export default CollectionEditPage;
