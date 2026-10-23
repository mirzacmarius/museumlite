"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CatalogItemForm } from "@/app/[locale]/(dashboard)/library/catalog/_components/catalog-item-form/catalog-item-form";
import {
  catalogItemFormToUpdatePayload,
  libraryItemToFormData,
} from "@/app/[locale]/(dashboard)/library/catalog/_components/catalog-item-form/form-payload";
import {
  type CatalogItemFormData,
  EMPTY_CATALOG_ITEM_FORM,
} from "@/app/[locale]/(dashboard)/library/catalog/_components/catalog-item-form/types";
import {
  applyIsbnLookupToForm,
  useCatalogItemAuthorFields,
  useCatalogItemFormLabels,
} from "@/app/[locale]/(dashboard)/library/catalog/_components/catalog-item-form/use-catalog-item-form-helpers";
import type { IsbnLookupData } from "@/components/library/isbn-lookup";
import { useOrganization } from "@/components/organization-provider";
import { useActionErrorMessage } from "@/hooks/use-action-error-message";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useScopedI18n } from "@/locales/client";

export function EditCatalogItemPageClient() {
  const params = useParams();
  const { push } = useRouter();
  const itemId = params.id as Id<"libraryItems">;
  const { currentOrganizationId } = useOrganization();
  const { hasModule } = useFeatureAccess();
  const tEdit = useScopedI18n("library.catalog.edit");
  const actionMessage = useActionErrorMessage();
  const tNew = useScopedI18n("library.catalog.new");
  const tLib = useScopedI18n("library");
  const { getItemTypeLabel, getAudienceLabel } = useCatalogItemFormLabels();

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CatalogItemFormData>(
    EMPTY_CATALOG_ITEM_FORM,
  );

  const isLibraryEnabled = hasModule("library");
  const item = useQuery(api.library.items.get, { itemId });
  const updateItem = useMutation(api.library.items.update);
  const { addAuthor, removeAuthor, updateAuthor } =
    useCatalogItemAuthorFields(setFormData);

  useEffect(() => {
    if (item) {
      setFormData(libraryItemToFormData(item));
    }
  }, [item]);

  const handleIsbnData = (data: IsbnLookupData) => {
    setFormData((prev) => applyIsbnLookupToForm(data, prev));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganizationId) return;

    setIsSaving(true);
    setError(null);

    try {
      await updateItem(catalogItemFormToUpdatePayload(itemId, formData));
      push(`/library/catalog/${itemId}`);
    } catch (err) {
      setError(actionMessage(err, tEdit("updateFailed")));
    } finally {
      setIsSaving(false);
    }
  };

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{tNew("selectOrganization")}</p>
      </div>
    );
  }

  if (isLibraryEnabled === false) {
    return (
      <div className="flex size-full items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">{tNew("notEnabled")}</p>
          <Button asChild className="mt-4">
            <Link href="/settings/integrations">
              {tLib("enableIntegration")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (item === undefined) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{tEdit("loading")}</p>
      </div>
    );
  }

  if (item === null) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{tEdit("notFound")}</p>
      </div>
    );
  }

  return (
    <div className="flex size-full bg-background px-6">
      <div className="z-10 mx-auto flex size-full max-w-screen-xl flex-col gap-6 py-6">
        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/library/catalog/${itemId}`}>
                <ArrowLeft className="mr-2 size-4" />
                {tEdit("back")}
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-medium">{tEdit("pageTitle")}</h1>
              <p className="text-sm text-muted-foreground">
                {tEdit("pageDescription")}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <CatalogItemForm
            formData={formData}
            setFormData={setFormData}
            getItemTypeLabel={getItemTypeLabel}
            getAudienceLabel={getAudienceLabel}
            onIsbnData={handleIsbnData}
            addAuthor={addAuthor}
            removeAuthor={removeAuthor}
            updateAuthor={updateAuthor}
            isSaving={isSaving}
            submitLabel={tEdit("saveChanges")}
            savingLabel={tEdit("saving")}
          />
        </form>
      </div>
    </div>
  );
}
