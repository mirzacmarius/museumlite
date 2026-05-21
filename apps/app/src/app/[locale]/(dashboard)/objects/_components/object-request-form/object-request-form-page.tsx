"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type {
  CollectionFormData,
  DraftMediaItem,
} from "../collection-form-shared";
import { ObjectRequestFormLayout } from "./object-request-form-layout";
import { useObjectRequestForm } from "./use-object-request-form";

export interface ObjectRequestFormPageProps {
  mode?: "create" | "draft-edit";
  accessionId?: Id<"accessions">;
  initialDraftObjectData?: Partial<CollectionFormData>;
  initialDraftMedia?: DraftMediaItem[];
  initialDraftSavedAt?: number | null;
  prefilledCollectionGroupId?: string;
  backHref?: string;
}

export function ObjectRequestFormPage(props: ObjectRequestFormPageProps) {
  const form = useObjectRequestForm(props);

  if (!form.currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{form.organizationPrompt}</p>
      </div>
    );
  }

  return <ObjectRequestFormLayout form={form} />;
}
