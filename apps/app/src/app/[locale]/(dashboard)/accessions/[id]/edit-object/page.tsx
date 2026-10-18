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

  // A pending accession recorded without an object, as on the accession form
  // or by import, has its object described here. One begun from an entry
  // already has its object, so its draft opens the accession form.
  const canDescribeObject =
    accession.status === "pending" && !accession.collectionId;
  const shouldEditAccessionFirst =
    accession.status === "pending" &&
    accession.workflowStep === 0 &&
    !accession.draftObjectData &&
    !canDescribeObject;

  if (shouldEditAccessionFirst) {
    redirect(`/accessions/${accessionId}/edit`);
  }

  // The form itself keeps a draft that left pending on screen while it
  // holds unsaved input; otherwise only pending drafts open here.
  if (!accession.draftObjectData && !canDescribeObject) {
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
