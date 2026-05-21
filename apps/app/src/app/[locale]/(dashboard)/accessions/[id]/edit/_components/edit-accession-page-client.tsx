"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Calendar, Info, Package, Save } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ClientDate } from "@/components/client-date";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useClientDate } from "@/hooks/use-client-date-format";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { EditAccessionEditSidebar } from "./edit-accession-edit-sidebar";
import {
  EditAccessionFormBody,
  type EditAccessionFormData,
} from "./edit-accession-form-body";

export function EditAccessionPageClient() {
  const params = useParams();
  const { push, back } = useRouter();
  const t = useScopedI18n("accessions");
  const tCommon = useScopedI18n("common");
  const locale = useCurrentLocale();
  const accessionId = params.id as string;
  const { currentOrganizationId } = useOrganization();
  const updateAccession = useMutation(api.accessions.update);

  const accession = useQuery(
    api.accessions.get,
    accessionId ? { accessionId: accessionId as Id<"accessions"> } : "skip",
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<EditAccessionFormData>({
    source: "",
    method: "purchase",
    cost: "",
    notes: "",
  });
  const dateReceivedLabel = useClientDate(accession?.dateReceived, locale);

  useEffect(() => {
    if (accession) {
      setFormData({
        source: accession.source || "",
        method: accession.method,
        cost: accession.cost?.toString() || "",
        notes: accession.notes || "",
      });
    }
  }, [accession]);

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">
          {t("selectOrganizationDescription")}
        </p>
      </div>
    );
  }

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
        <p className="text-muted-foreground">{t("accessionNotFound")}</p>
      </div>
    );
  }

  if (accession.status !== "pending") {
    return (
      <div className="flex size-full bg-background px-6">
        <div className="z-10 mx-auto flex size-full max-w-screen-xl gap-12">
          <div className="flex w-full flex-col rounded-lg border border-border bg-card">
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <p className="text-muted-foreground">
                  {t("detail.cannotEditNotPending")}
                </p>
                <Button variant="outline" className="mt-4" asChild>
                  <Link href={`/accessions/${accessionId}`}>
                    {t("detail.backToAccession")}
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.source.trim()) {
      setError(t("error.sourceRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      await updateAccession({
        accessionId: accessionId as Id<"accessions">,
        source: formData.source,
        method: formData.method,
        cost: formData.cost ? Number.parseFloat(formData.cost) : undefined,
        notes: formData.notes || undefined,
      });
      push(`/accessions/${accessionId}`);
    } catch (err) {
      console.error("Error updating accession:", err);
      setError(err instanceof Error ? err.message : t("error.failedToUpdate"));
      setIsSubmitting(false);
    }
  };

  return (
    <main className="z-10 flex h-full min-h-0 min-w-0 w-full flex-1 flex-col bg-background">
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border/60 bg-background/80 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-2 text-xs">
          <Button variant="ghost" size="icon" className="size-7" asChild>
            <Link href={`/accessions/${accessionId}`}>
              <ArrowLeft className="size-4 text-muted-foreground" />
            </Link>
          </Button>
          <span className="text-muted-foreground">Accessions</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="font-medium text-foreground">
            {accession.accessionNumber}
          </span>
        </div>

        <PermissionGate permission="collections.update">
          <Button
            type="submit"
            form="accession-edit-form"
            disabled={isSubmitting}
          >
            <Save className="mr-2 size-4" />
            {isSubmitting ? t("form.updating") : t("form.updateAccession")}
          </Button>
        </PermissionGate>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-border/60 bg-secondary/10 p-8">
          <div className="mx-auto flex max-w-5xl flex-col gap-8 lg:flex-row lg:items-start">
            <div className="flex size-48 shrink-0 flex-col items-center justify-center rounded-xl border border-border/60 bg-secondary text-center shadow-2xl">
              <Save className="size-10 text-muted-foreground" />
              <div className="mt-4 space-y-1 px-6">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Pending accession
                </p>
                <p className="text-sm font-medium text-foreground">
                  {accession.accessionNumber}
                </p>
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="rounded bg-yellow-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-yellow-600 dark:text-yellow-400">
                  {accession.status}
                </div>
                <div className="rounded bg-background/80 px-2 py-1 text-[10px] font-mono text-muted-foreground">
                  {accession.accessionNumber}
                </div>
              </div>

              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Edit accession
              </h1>

              <p className="max-w-3xl text-sm text-muted-foreground">
                Update the intake record while it is still pending. Once
                approved, the accession should be treated as a finalized
                workflow record.
              </p>

              <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="size-4" />
                  <span>
                    Received{" "}
                    <ClientDate
                      timestamp={accession.dateReceived}
                      locale={locale}
                    />
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Info className="size-4" />
                  <span>{accession.source || "No source yet"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Package className="size-4" />
                  <span className="capitalize">{accession.method}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-6xl px-6 py-8">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <EditAccessionFormBody
              accessionNumber={accession.accessionNumber}
              dateReceivedLabel={dateReceivedLabel}
              formData={formData}
              setFormData={setFormData}
              error={error}
              isSubmitting={isSubmitting}
              onSubmit={handleSubmit}
              onCancel={() => back()}
            />
            <EditAccessionEditSidebar formData={formData} />
          </div>
        </div>
      </div>
    </main>
  );
}
