"use client";

import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ObjectRequestFormPage } from "../../../objects/new/page";

export default function EditAccessionObjectPage() {
  const params = useParams();
  const accessionId = params.id as string;
  const router = useRouter();
  const tCommon = useScopedI18n("common");

  const accession = useQuery(
    api.accessions.get,
    accessionId ? { accessionId: accessionId as Id<"accessions"> } : "skip",
  );

  if (accession === undefined) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">{tCommon("loading")}</p>
      </div>
    );
  }

  if (accession === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Accession not found.</p>
      </div>
    );
  }

  const isDraft =
    accession.status === "pending" && accession.workflowStep === 0;

  useEffect(() => {
    if (accession && isDraft && !accession.draftObjectData) {
      router.replace(`/accessions/${accessionId}/edit`);
    }
  }, [accession, accessionId, isDraft, router]);

  if (!isDraft || !accession.draftObjectData) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">
          Only accession drafts can be edited from this screen.
        </p>
      </div>
    );
  }

  return (
    <ObjectRequestFormPage
      mode="draft-edit"
      accessionId={accession._id}
      initialDraftObjectData={accession.draftObjectData}
      initialDraftMedia={accession.draftMedia}
      initialDraftSavedAt={accession._creationTime}
      backHref={`/accessions/${accessionId}`}
    />
  );
}
