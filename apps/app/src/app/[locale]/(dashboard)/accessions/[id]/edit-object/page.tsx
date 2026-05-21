"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { redirect, useParams } from "next/navigation";
import { Suspense } from "react";
import { useScopedI18n } from "@/locales/client";
import { ObjectRequestFormPage } from "../../../objects/new/page";

export default function EditAccessionObjectPage() {
  const params = useParams();
  const accessionId = params.id as string;
  const tCommon = useScopedI18n("common");

  const accession = useQuery(
    api.accessions.get,
    accessionId ? { accessionId: accessionId as Id<"accessions"> } : "skip",
  );

  if (accession === undefined) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{tCommon("loading")}</p>
      </div>
    );
  }

  if (accession === null) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">Accession not found.</p>
      </div>
    );
  }

  const canEditObjectDraft =
    accession.status === "pending" && Boolean(accession.draftObjectData);
  const shouldEditAccessionFirst =
    accession.status === "pending" &&
    accession.workflowStep === 0 &&
    !accession.draftObjectData;

  if (shouldEditAccessionFirst) {
    redirect(`/accessions/${accessionId}/edit`);
  }

  if (!canEditObjectDraft || !accession.draftObjectData) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">
          Only pending accession object drafts can be edited from this screen.
        </p>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex size-full items-center justify-center">
          <p className="text-muted-foreground">{tCommon("loading")}</p>
        </div>
      }
    >
      <ObjectRequestFormPage
        mode="draft-edit"
        accessionId={accession._id}
        initialDraftObjectData={accession.draftObjectData}
        initialDraftMedia={accession.draftMedia}
        initialDraftSavedAt={accession._creationTime}
        backHref={`/accessions/${accessionId}`}
      />
    </Suspense>
  );
}
