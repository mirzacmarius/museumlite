"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useClientDate } from "@/hooks/use-client-date-format";
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

type DeaccessionMethod = "sale" | "donation" | "destruction" | "transfer";
type DeaccessionTargetStatus = "deaccessioned" | "archived" | "deleted";

export default function EditDeaccessionPage() {
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
  const [formData, setFormData] = useState({
    reason: "",
    method: "sale" as DeaccessionMethod,
    targetCollectionStatus: "deaccessioned" as DeaccessionTargetStatus,
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

          <form onSubmit={handleSubmit} className="p-6">
            {error && (
              <div className="mb-6 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="mx-auto max-w-2xl space-y-6">
              <div className="space-y-2">
                <Label>{t("form.deaccessionNumber")}</Label>
                <Input
                  value={deaccession.deaccessionNumber}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  {t("form.deaccessionNumberReadonly")}
                </p>
              </div>

              <div className="space-y-2">
                <Label>{t("form.dateDeaccessioned")}</Label>
                <Input
                  value={dateDeaccessionedLabel}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  {t("form.dateDeaccessionedReadonly")}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">{t("form.reasonLabel")}</Label>
                <Input
                  id="reason"
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, reason: e.target.value }))
                  }
                  placeholder={t("form.reasonPlaceholder")}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetCollectionStatus">Requested Action</Label>
                <Select
                  value={formData.targetCollectionStatus}
                  onValueChange={(value) => {
                    const nextTargetCollectionStatus =
                      value as DeaccessionTargetStatus;
                    setFormData((prev) => ({
                      ...prev,
                      targetCollectionStatus: nextTargetCollectionStatus,
                      method:
                        nextTargetCollectionStatus === "deaccessioned"
                          ? formData.method
                          : "destruction",
                    }));
                  }}
                >
                  <SelectTrigger id="targetCollectionStatus">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deaccessioned">Deaccession</SelectItem>
                    <SelectItem value="archived">Archive</SelectItem>
                    <SelectItem value="deleted">Delete</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="method">{t("form.methodLabel")}</Label>
                <Select
                  value={formData.method}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      method: value as DeaccessionMethod,
                    }))
                  }
                >
                  <SelectTrigger
                    id="method"
                    disabled={
                      formData.targetCollectionStatus !== "deaccessioned"
                    }
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sale">{t("form.methodSale")}</SelectItem>
                    <SelectItem value="donation">
                      {t("form.methodDonation")}
                    </SelectItem>
                    <SelectItem value="destruction">
                      {t("form.methodDestruction")}
                    </SelectItem>
                    <SelectItem value="transfer">
                      {t("form.methodTransfer")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                {formData.targetCollectionStatus !== "deaccessioned" ? (
                  <p className="text-xs text-muted-foreground">
                    Archive and delete requests use the deaccession approval
                    workflow and do not need a separate disposal method.
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="disposition">
                  {t("form.dispositionLabel")}
                </Label>
                <Input
                  id="disposition"
                  value={formData.disposition}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      disposition: e.target.value,
                    }))
                  }
                  placeholder={t("form.dispositionPlaceholder")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">{t("form.notesLabel")}</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder={t("form.notesPlaceholder")}
                  rows={4}
                />
              </div>

              {formData.targetCollectionStatus === "deaccessioned" &&
                formData.method === "sale" && (
                  <div className="border-t border-border pt-6 mt-6">
                    <h3 className="text-sm font-medium text-foreground mb-4">
                      {t("form.proceedsTitle")}
                    </h3>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="proceedsAmount">
                            {t("form.proceedsAmount")}
                          </Label>
                          <Input
                            id="proceedsAmount"
                            type="number"
                            step="0.01"
                            value={formData.proceedsAmount}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                proceedsAmount: e.target.value,
                              }))
                            }
                            placeholder={t("form.proceedsAmountPlaceholder")}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="proceedsCurrency">
                            {t("form.proceedsCurrency")}
                          </Label>
                          <Select
                            value={formData.proceedsCurrency}
                            onValueChange={(value) =>
                              setFormData((prev) => ({
                                ...prev,
                                proceedsCurrency: value,
                              }))
                            }
                          >
                            <SelectTrigger id="proceedsCurrency">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="USD">USD</SelectItem>
                              <SelectItem value="EUR">EUR</SelectItem>
                              <SelectItem value="GBP">GBP</SelectItem>
                              <SelectItem value="CHF">CHF</SelectItem>
                              <SelectItem value="NOK">NOK</SelectItem>
                              <SelectItem value="SEK">SEK</SelectItem>
                              <SelectItem value="DKK">DKK</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="proceedsRecipient">
                            {t("form.proceedsRecipient")}
                          </Label>
                          <Input
                            id="proceedsRecipient"
                            value={formData.proceedsRecipient}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                proceedsRecipient: e.target.value,
                              }))
                            }
                            placeholder={t("form.proceedsRecipientPlaceholder")}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="proceedsDate">
                            {t("form.proceedsDate")}
                          </Label>
                          <Input
                            id="proceedsDate"
                            type="date"
                            value={formData.proceedsDate}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                proceedsDate: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="proceedsNotes">
                          {t("form.proceedsNotes")}
                        </Label>
                        <Textarea
                          id="proceedsNotes"
                          value={formData.proceedsNotes}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              proceedsNotes: e.target.value,
                            }))
                          }
                          placeholder={t("form.proceedsNotesPlaceholder")}
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>
                )}

              <div className="flex justify-end gap-4">
                <Button type="button" variant="outline" onClick={() => back()}>
                  {tCommon("cancel")}
                </Button>
                <PermissionGate permission="collections.update">
                  <Button type="submit" disabled={isSubmitting}>
                    <Save className="mr-2 size-4" />
                    {isSubmitting ? t("actions.updating") : t("actions.update")}
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
