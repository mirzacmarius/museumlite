"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { redirect, useParams } from "next/navigation";
import { Suspense } from "react";
import { useI18n, useScopedI18n } from "@/locales/client";
import { ObjectRequestFormPage } from "../../../objects/_components/object-request-form/object-request-form-page";
export default function EditAccessionObjectPage() {
  const tRoot = useI18n();
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
        <p className="text-muted-foreground">
          {tRoot("untranslatedRecords.accessions.notFoundWithPeriod")}
        </p>
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
          {tRoot("untranslatedRecords.accessions.pendingDraftOnly")}
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
        key={accession._id}
        mode="draft-edit"
        accession={accession}
        backHref={`/accessions/${accessionId}`}
      />
    </Suspense>
  );
}
