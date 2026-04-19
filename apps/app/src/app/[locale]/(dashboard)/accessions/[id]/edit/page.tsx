"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { formatDate } from "@/lib/format-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Textarea } from "@v1/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Calendar, Info, Package, Save } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

function EditSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-5 border-b border-border/60 pb-8 last:border-b-0 last:pb-0">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export default function EditAccessionPage() {
  const params = useParams();
  const router = useRouter();
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
  const [formData, setFormData] = useState({
    source: "",
    method: "purchase" as
      | "purchase"
      | "gift"
      | "loan"
      | "transfer"
      | "donation"
      | "other"
      | "bequest",
    cost: "",
    notes: "",
  });

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
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">
          {t("selectOrganizationDescription")}
        </p>
      </div>
    );
  }

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
        <p className="text-muted-foreground">{t("accessionNotFound")}</p>
      </div>
    );
  }

  if (accession.status !== "pending") {
    return (
      <div className="flex h-full w-full bg-background px-6">
        <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
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
      router.push(`/accessions/${accessionId}`);
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
          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
            <Link href={`/accessions/${accessionId}`}>
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            </Link>
          </Button>
          <span className="text-muted-foreground">Accessions</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="font-medium text-foreground">
            {accession.accessionNumber}
          </span>
        </div>

        <PermissionGate permission="collections.update">
          <Button type="submit" form="accession-edit-form" disabled={isSubmitting}>
            <Save className="mr-2 h-4 w-4" />
            {isSubmitting ? t("form.updating") : t("form.updateAccession")}
          </Button>
        </PermissionGate>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-border/60 bg-secondary/10 px-8 py-8">
          <div className="mx-auto flex max-w-5xl flex-col gap-8 lg:flex-row lg:items-start">
            <div className="flex h-48 w-48 shrink-0 flex-col items-center justify-center rounded-xl border border-border/60 bg-secondary text-center shadow-2xl">
              <Save className="h-10 w-10 text-muted-foreground" />
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
                Update the intake record while it is still pending. Once approved,
                the accession should be treated as a finalized workflow record.
              </p>

              <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Received {formatDate(new Date(accession.dateReceived), locale)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  <span>{accession.source || "No source yet"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  <span className="capitalize">{accession.method}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-4xl px-6 py-8">
          <form
            id="accession-edit-form"
            onSubmit={handleSubmit}
            className="rounded-2xl border border-border/60 bg-background/70 px-5 py-6 shadow-sm sm:px-8 sm:py-8"
          >
            {error ? (
              <div className="mb-6 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <div className="space-y-8">
              <EditSection
                title="Locked intake details"
                description="These identifiers are set when the accession is created and stay read-only during pending review."
              >
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("form.accessionNumber")}</Label>
                    <Input
                      value={accession.accessionNumber}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("detail.accessionNumberCannotChange")}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("form.dateReceived")}</Label>
                    <Input
                      value={formatDate(new Date(accession.dateReceived), locale)}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("detail.dateReceivedCannotChange")}
                    </p>
                  </div>
                </div>
              </EditSection>

              <EditSection
                title="Accession information"
                description="Edit source, acquisition method, valuation context, and any staff notes before approval."
              >
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="source">
                      {t("form.source")} {t("form.required")}
                    </Label>
                    <Input
                      id="source"
                      value={formData.source}
                      onChange={(e) =>
                        setFormData({ ...formData, source: e.target.value })
                      }
                      placeholder={t("form.sourcePlaceholder")}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="method">
                      {t("form.method")} {t("form.required")}
                    </Label>
                    <Select
                      value={formData.method}
                      onValueChange={(
                        value:
                          | "purchase"
                          | "gift"
                          | "loan"
                          | "transfer"
                          | "donation"
                          | "other"
                          | "bequest",
                      ) => setFormData({ ...formData, method: value })}
                    >
                      <SelectTrigger id="method">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="purchase">
                          {t("form.methods.purchase")}
                        </SelectItem>
                        <SelectItem value="gift">
                          {t("form.methods.gift")}
                        </SelectItem>
                        <SelectItem value="loan">
                          {t("form.methods.loan")}
                        </SelectItem>
                        <SelectItem value="transfer">
                          {t("form.methods.transfer")}
                        </SelectItem>
                        <SelectItem value="donation">
                          {t("form.methods.donation")}
                        </SelectItem>
                        <SelectItem value="bequest">
                          {t("form.methods.bequest")}
                        </SelectItem>
                        <SelectItem value="other">
                          {t("form.methods.other")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cost">{t("form.cost")}</Label>
                    <Input
                      id="cost"
                      type="number"
                      step="0.01"
                      value={formData.cost}
                      onChange={(e) =>
                        setFormData({ ...formData, cost: e.target.value })
                      }
                      placeholder={t("form.costPlaceholder")}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="notes">{t("form.notes")}</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      placeholder={t("form.notesPlaceholder")}
                      rows={4}
                    />
                  </div>
                </div>
              </EditSection>

              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                >
                  {tCommon("cancel")}
                </Button>
                <PermissionGate permission="collections.update">
                  <Button type="submit" disabled={isSubmitting}>
                    <Save className="mr-2 h-4 w-4" />
                    {isSubmitting
                      ? t("form.updating")
                      : t("form.updateAccession")}
                  </Button>
                </PermissionGate>
              </div>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
