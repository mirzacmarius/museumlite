"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useOrganization } from "@/components/organization-provider";
import { useClientDate } from "@/hooks/use-client-date-format";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { EditDeaccessionForm } from "./edit-deaccession-form";
import type { EditDeaccessionFormData } from "./edit-deaccession-form-types";

export function EditDeaccessionPageClient() {
  const params = useParams();
  const { push, back } = useRouter();
  const t = useScopedI18n("deaccessions");
  const tCommon = useScopedI18n("common");
  const locale = useCurrentLocale();
  const deaccessionId = params.id as string;
  const { currentOrganizationId } = useOrganization();
  const updateDeaccession = useMutation(api.deaccessions.update);

  const deaccession = useQuery(
    api.deaccessions.get,
    deaccessionId
      ? { deaccessionId: deaccessionId as Id<"deaccessions"> }
      : "skip",
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<EditDeaccessionFormData>({
    reason: "",
    method: "sale",
    targetCollectionStatus: "deaccessioned",
    disposition: "",
    notes: "",
    proceedsAmount: "",
    proceedsCurrency: "USD",
    proceedsRecipient: "",
    proceedsDate: "",
    proceedsNotes: "",
  });
  const dateDeaccessionedLabel = useClientDate(
    deaccession?.dateDeaccessioned,
    locale,
  );

  useEffect(() => {
    if (deaccession) {
      setFormData({
        reason: deaccession.reason || "",
        method: deaccession.method,
        targetCollectionStatus: deaccession.targetCollectionStatus,
        disposition: deaccession.disposition || "",
        notes: deaccession.notes || "",
        proceedsAmount: deaccession.proceedsAmount?.toString() || "",
        proceedsCurrency: deaccession.proceedsCurrency || "USD",
        proceedsRecipient: deaccession.proceedsRecipient || "",
        proceedsDate: deaccession.proceedsDate
          ? new Date(deaccession.proceedsDate).toISOString().slice(0, 10)
          : "",
        proceedsNotes: deaccession.proceedsNotes || "",
      });
    }
  }, [deaccession]);

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{t("form.selectOrgEdit")}</p>
      </div>
    );
  }

  if (deaccession === undefined) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{tCommon("loading")}</p>
      </div>
    );
  }

  if (deaccession === null) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{t("detail.notFound")}</p>
      </div>
    );
  }

  if (deaccession.status !== "pending") {
    return (
      <div className="flex size-full bg-background px-6">
        <div className="z-10 mx-auto flex size-full max-w-screen-xl gap-12">
          <div className="flex w-full flex-col rounded-lg border border-border bg-card">
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <p className="text-muted-foreground">
                  {t("form.errors.cannotEdit")}
                </p>
                <Button variant="outline" className="mt-4" asChild>
                  <Link href={`/deaccessions/${deaccessionId}`}>
                    {t("actions.backToDeaccession")}
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
    if (!formData.reason.trim()) {
      setError(t("form.errors.reasonRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      await updateDeaccession({
        deaccessionId: deaccessionId as Id<"deaccessions">,
        reason: formData.reason,
        method: formData.method,
        targetCollectionStatus: formData.targetCollectionStatus,
        disposition: formData.disposition || undefined,
        notes: formData.notes || undefined,
        proceedsAmount: formData.proceedsAmount
          ? Number.parseFloat(formData.proceedsAmount)
          : undefined,
        proceedsCurrency: formData.proceedsCurrency || undefined,
        proceedsRecipient: formData.proceedsRecipient || undefined,
        proceedsDate: formData.proceedsDate
          ? new Date(formData.proceedsDate).getTime()
          : undefined,
        proceedsNotes: formData.proceedsNotes || undefined,
      });
      push(`/deaccessions/${deaccessionId}`);
    } catch (err) {
      console.error("Error updating deaccession:", err);
      setError(
        err instanceof Error ? err.message : t("form.errors.updateFailed"),
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex size-full bg-background px-6">
      <div className="z-10 mx-auto flex size-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <div className="flex w-full items-center justify-between rounded-lg border-b border-border p-6">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/deaccessions/${deaccessionId}`}>
                <ArrowLeft className="mr-2 size-4" />
                {t("actions.backToDeaccession")}
              </Link>
            </Button>
          </div>

          <EditDeaccessionForm
            deaccessionNumber={deaccession.deaccessionNumber}
            dateDeaccessionedLabel={dateDeaccessionedLabel}
            formData={formData}
            setFormData={setFormData}
            error={error}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
            onCancel={() => back()}
          />
        </div>
      </div>
    </div>
  );
}
