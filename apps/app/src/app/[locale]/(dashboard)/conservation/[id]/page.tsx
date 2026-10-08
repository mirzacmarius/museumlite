"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import { ArrowLeft, Box, Calendar, Loader2, Pencil, User } from "lucide-react";
import Link from "next/link";
import { use } from "react";
import { ClientDate } from "@/components/client-date";
import { PermissionGate } from "@/components/permission-gate";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

import { TreatmentEvidencePanel } from "./_components/treatment-evidence-panel";

const TREATMENT_TYPE_STYLES: Record<string, string> = {
  routine: "bg-muted text-muted-foreground border-border",
  stabilization: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  restoration: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  cleaning: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  repair: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  assessment: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  other: "bg-muted text-muted-foreground border-border",
};

export default function TreatmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const locale = useCurrentLocale();
  const t = useScopedI18n("conservation");
  const { id } = use(params);

  const treatment = useQuery(api.conservationTreatments.get, {
    id: id as Id<"conservationTreatments">,
  });

  if (treatment === undefined) {
    return (
      <div className="flex size-full items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (treatment === null) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-4 bg-background">
        <p className="text-muted-foreground">{t("detail.notFound")}</p>
        <Button asChild variant="outline">
          <Link href="/conservation">{t("detail.backToList")}</Link>
        </Button>
      </div>
    );
  }

  const typeStyle =
    TREATMENT_TYPE_STYLES[treatment.treatmentType] ||
    TREATMENT_TYPE_STYLES.other;

  return (
    <div className="flex size-full bg-background px-6 py-8">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <div className="flex items-start justify-between">
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="-ml-3 text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <Link href="/conservation">
                <ArrowLeft className="mr-2 size-4" />
                {t("detail.backToList")}
              </Link>
            </Button>

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider ${typeStyle}`}
                >
                  {treatment.treatmentType}
                </span>
                {treatment.status && (
                  <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-white/80">
                    {treatment.status.replace("_", " ")}
                  </span>
                )}
                <span className="text-sm text-muted-foreground">
                  {t("detail.created")}{" "}
                  <ClientDate
                    timestamp={treatment._creationTime}
                    locale={locale}
                  />
                </span>
              </div>
              <h1 className="text-3xl font-semibold text-foreground">
                {treatment.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <PermissionGate permission="collections.update">
              <Button
                variant="outline"
                asChild
                className="border-border bg-muted/50 text-foreground/80 hover:bg-accent hover:text-foreground"
              >
                <Link href={`/conservation/${id}/edit`}>
                  <Pencil className="mr-2 size-4" />
                  {t("detail.edit")}
                </Link>
              </Button>
            </PermissionGate>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <h3 className="text-lg font-medium text-foreground">
                {t("detail.description")}
              </h3>
              <div className="prose prose-invert max-w-none text-muted-foreground whitespace-pre-wrap">
                {treatment.description}
              </div>
            </div>

            {treatment.notes && (
              <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                <h3 className="text-lg font-medium text-foreground">
                  {t("detail.notes")}
                </h3>
                <div className="prose prose-invert max-w-none text-muted-foreground whitespace-pre-wrap">
                  {treatment.notes}
                </div>
              </div>
            )}

            <TreatmentEvidencePanel
              treatmentId={treatment._id}
              collectionId={treatment.collectionId}
              status={treatment.status}
            />
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-6 space-y-6">
              <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                {t("detail.details")}
              </h3>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Box className="mt-0.5 size-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t("detail.collectionObject")}
                    </p>
                    <Link
                      href={`/collections/${treatment.collectionId}`}
                      className="text-sm text-blue-400 hover:text-blue-300 hover:underline"
                    >
                      {treatment.collectionTitle || t("detail.unknownObject")}
                    </Link>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="mt-0.5 size-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t("detail.datePerformed")}
                    </p>
                    <p className="text-sm text-foreground/80">
                      <ClientDate
                        timestamp={treatment.performedAt}
                        locale={locale}
                      />
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <User className="mt-0.5 size-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t("detail.performedBy")}
                    </p>
                    <p className="text-sm text-foreground/80">
                      {treatment.performedByName || t("detail.unknown")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
