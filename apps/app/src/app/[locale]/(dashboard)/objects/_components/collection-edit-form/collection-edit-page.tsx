"use client";

import { useScopedI18n } from "@/locales/client";
import { CollectionEditFormLayout } from "./collection-edit-form-layout";
import { useCollectionEditForm } from "./use-collection-edit-form";

export function CollectionEditPage() {
  const common = useScopedI18n("common");
  const form = useCollectionEditForm();

  if (!form.currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">
          Please select an organization to edit objects.
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
        <p className="text-muted-foreground">Collection not found</p>
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
