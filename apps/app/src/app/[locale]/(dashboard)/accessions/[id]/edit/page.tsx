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
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
    <div className="flex h-full w-full bg-background px-6">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <div className="flex w-full items-center justify-between rounded-lg border-b border-border p-6">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/accessions/${accessionId}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("detail.backToAccession")}
              </Link>
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            {error && (
              <div className="mb-6 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="mx-auto max-w-2xl space-y-6">
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

              <div className="space-y-2">
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

              <div className="space-y-2">
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
    </div>
  );
}
