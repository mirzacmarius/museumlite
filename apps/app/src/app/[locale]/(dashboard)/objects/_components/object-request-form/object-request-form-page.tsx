"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
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

function ObjectRequestFormFallback() {
  return (
    <div className="flex size-full items-center justify-center">
      <p className="text-muted-foreground">Loading form…</p>
    </div>
  );
}

function ObjectRequestFormPageInner(props: ObjectRequestFormPageProps) {
  const searchParams = useSearchParams();
  const collectionGroupIdFromUrl = searchParams.get("collectionGroupId");
  const collectionGroupId =
    props.prefilledCollectionGroupId ||
    collectionGroupIdFromUrl ||
    undefined;

  const form = useObjectRequestForm({
    ...props,
    prefilledCollectionGroupId: collectionGroupId,
  });

  if (!form.currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{form.organizationPrompt}</p>
      </div>
    );
  }

  return <ObjectRequestFormLayout form={form} />;
}

export function ObjectRequestFormPage(props: ObjectRequestFormPageProps) {
  return (
    <Suspense fallback={<ObjectRequestFormFallback />}>
      <ObjectRequestFormPageInner {...props} />
    </Suspense>
  );
}
