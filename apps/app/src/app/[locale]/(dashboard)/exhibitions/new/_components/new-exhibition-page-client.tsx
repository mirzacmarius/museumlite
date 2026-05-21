"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Info, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { ExhibitionFormSections } from "../../_components/exhibition-form-sections";
import type { ExhibitionFormData } from "../../_components/exhibition-form-types";
import { ExhibitionScheduleConflictsAlert } from "../../_components/exhibition-schedule-conflicts-alert";

export function NewExhibitionPageClient() {
  const { push, back } = useRouter();
  const { currentOrganizationId } = useOrganization();
  const t = useScopedI18n("exhibitions");
  const createExhibition = useMutation(api.exhibitions.create);
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
    collectionId: undefined,
  });

  const conflicts = useQuery(
    api.exhibitions.checkScheduleConflicts,
    formData.collectionId
      ? {
          collectionId: formData.collectionId as Id<"collections">,
          startDate: formData.startDate.getTime(),
          endDate: formData.endDate?.getTime(),
        }
      : "skip",
  );

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center bg-background">
        <p className="text-muted-foreground">{t("form.selectOrganization")}</p>
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
    if (!formData.collectionId) {
      setError(t("form.selectObject"));
      return;
    }

    setIsSubmitting(true);
    try {
      await createExhibition({
        collectionId: formData.collectionId as Id<"collections">,
        title: formData.title,
        location: formData.location || undefined,
        startDate: formData.startDate.getTime(),
        endDate: formData.endDate ? formData.endDate.getTime() : undefined,
        isCurrent: formData.isCurrent,
        isLoan: formData.isLoan,
        loanVenue: formData.isLoan ? formData.loanVenue : undefined,
        notes: formData.notes || undefined,
      });
      push("/exhibitions");
    } catch (err) {
      console.error("Error creating exhibition:", err);
      setError(t("form.createError"));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-2 text-xs">
          <Button variant="ghost" size="icon" className="size-7" asChild>
            <Link href="/exhibitions">
              <ArrowLeft className="size-4 text-muted-foreground" />
            </Link>
          </Button>
          <span className="text-muted-foreground">{t("title")}</span>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium text-foreground">
            {t("form.breadcrumbNew")}
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-8 pb-20">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {t("form.newExhibitionTitle")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("form.newExhibitionSubtitle")}
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
              mode="create"
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
                  {isSubmitting
                    ? t("actions.creating")
                    : t("actions.createExhibition")}
                </Button>
              </PermissionGate>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
