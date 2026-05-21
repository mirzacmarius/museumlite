"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Info, Save } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { ExhibitionFormSections } from "../../../_components/exhibition-form-sections";
import type { ExhibitionFormData } from "../../../_components/exhibition-form-types";
import { ExhibitionScheduleConflictsAlert } from "../../../_components/exhibition-schedule-conflicts-alert";

export function EditExhibitionPageClient() {
  const { push, back } = useRouter();
  const params = useParams();
  const exhibitionId = params.id as string;
  const { currentOrganizationId } = useOrganization();
  const t = useScopedI18n("exhibitions");
  const updateExhibition = useMutation(api.exhibitions.update);

  const exhibition = useQuery(api.exhibitions.get, {
    id: exhibitionId as Id<"exhibitions">,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<ExhibitionFormData>({
    title: "",
    location: "",
    startDate: new Date(),
    endDate: undefined,
    isCurrent: false,
    isLoan: false,
    loanVenue: "",
    notes: "",
  });

  useEffect(() => {
    if (exhibition) {
      setFormData({
        title: exhibition.title,
        location: exhibition.location || "",
        startDate: new Date(exhibition.startDate),
        endDate: exhibition.endDate ? new Date(exhibition.endDate) : undefined,
        isCurrent: exhibition.isCurrent,
        isLoan: exhibition.isLoan || false,
        loanVenue: exhibition.loanVenue || "",
        notes: exhibition.notes || "",
      });
    }
  }, [exhibition]);

  const conflicts = useQuery(
    api.exhibitions.checkScheduleConflicts,
    exhibition?.collectionId
      ? {
          collectionId: exhibition.collectionId,
          startDate: formData.startDate.getTime(),
          endDate: formData.endDate?.getTime(),
          excludeExhibitionId: exhibitionId as Id<"exhibitions">,
        }
      : "skip",
  );

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center bg-background">
        <p className="text-muted-foreground">{t("selectOrganization")}</p>
      </div>
    );
  }

  if (exhibition === undefined) {
    return (
      <div className="flex size-full items-center justify-center bg-background">
        <p className="text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (exhibition === null) {
    return (
      <div className="flex size-full items-center justify-center bg-background">
        <p className="text-muted-foreground">{t("exhibitionNotFound")}</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title.trim()) {
      setError(t("form.titleRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      await updateExhibition({
        id: exhibitionId as Id<"exhibitions">,
        title: formData.title,
        location: formData.location || undefined,
        startDate: formData.startDate.getTime(),
        endDate: formData.endDate ? formData.endDate.getTime() : undefined,
        isCurrent: formData.isCurrent,
        isLoan: formData.isLoan,
        loanVenue: formData.isLoan ? formData.loanVenue : undefined,
        notes: formData.notes || undefined,
      });
      push(`/exhibitions/${exhibitionId}`);
    } catch (err) {
      console.error("Error updating exhibition:", err);
      setError(t("form.updateError"));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-2 text-xs">
          <Button variant="ghost" size="icon" className="size-7" asChild>
            <Link href={`/exhibitions/${exhibitionId}`}>
              <ArrowLeft className="size-4 text-muted-foreground" />
            </Link>
          </Button>
          <span className="text-muted-foreground">{t("title")}</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-muted-foreground truncate max-w-[150px]">
            {exhibition.title}
          </span>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium text-foreground">
            {t("actions.edit")}
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-8 pb-20">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {t("form.editTitle")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("form.editSubtitle")}{" "}
              <span className="text-foreground/80">{exhibition.title}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400 flex items-center gap-2">
                <Info className="size-4" />
                {error}
              </div>
            )}

            {conflicts?.hasConflicts && (
              <ExhibitionScheduleConflictsAlert
                conflicts={conflicts.conflicts}
              />
            )}

            <ExhibitionFormSections
              formData={formData}
              onFormDataChange={setFormData}
              organizationId={currentOrganizationId}
              mode="edit"
            />

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => back()}
                className="border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {t("actions.cancel")}
              </Button>
              <PermissionGate permission="collections.update">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Save className="mr-2 size-4" />
                  {isSubmitting ? t("actions.saving") : t("actions.save")}
                </Button>
              </PermissionGate>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
