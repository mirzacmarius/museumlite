"use client";

import { useScopedI18n } from "@/locales/client";

import { CollectionSelector } from "@/components/collection-selector";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { DatePicker } from "@v1/ui/date-picker";
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
import { useMutation } from "convex/react";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewDeaccessionPage() {
  const router = useRouter();
  const t = useScopedI18n("deaccessions");
  const { currentOrganizationId } = useOrganization();
  const createDeaccession = useMutation(api.deaccessions.create);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    collectionId: "",
    deaccessionNumber: "",
    dateDeaccessioned: new Date(),
    reason: "",
    method: "sale" as "sale" | "donation" | "destruction" | "transfer",
    disposition: "",
    notes: "",
  });

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">{t("form.selectOrg")}</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.collectionId.trim()) {
      setError(t("form.errors.collectionRequired"));
      return;
    }
    if (!formData.reason.trim()) {
      setError(t("form.errors.reasonRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      await createDeaccession({
        organizationId: currentOrganizationId as Id<"organizations">,
        collectionId: formData.collectionId as Id<"collections">,
        deaccessionNumber: formData.deaccessionNumber || undefined,
        dateDeaccessioned: formData.dateDeaccessioned.getTime(),
        reason: formData.reason,
        method: formData.method,
        disposition: formData.disposition || undefined,
        notes: formData.notes || undefined,
      });
      router.push("/deaccessions");
    } catch (err) {
      console.error("Error creating deaccession:", err);
      setError(
        err instanceof Error ? err.message : t("form.errors.createFailed"),
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-full w-full bg-background px-6">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <div className="flex w-full items-center justify-between rounded-lg border-b border-border p-6">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/deaccessions">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("actions.backToDeaccessions")}
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
              <CollectionSelector
                organizationId={currentOrganizationId}
                value={formData.collectionId}
                onValueChange={(value) =>
                  setFormData({ ...formData, collectionId: value })
                }
                placeholder={t("form.collectionPlaceholder")}
                label={t("form.collectionLabel")}
                required
                excludeDeaccessioned
              />

              <div className="space-y-2">
                <Label htmlFor="deaccessionNumber">
                  {t("form.deaccessionNumber")}
                </Label>
                <Input
                  id="deaccessionNumber"
                  value={formData.deaccessionNumber}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      deaccessionNumber: e.target.value,
                    })
                  }
                  placeholder={t("form.deaccessionNumberPlaceholder")}
                />
                <p className="text-xs text-muted-foreground">
                  {t("form.deaccessionNumberHint")}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dateDeaccessioned">
                    {t("form.dateDeaccessioned")}
                  </Label>
                  <DatePicker
                    id="dateDeaccessioned"
                    date={formData.dateDeaccessioned}
                    onSelect={(date: Date | undefined) =>
                      setFormData({
                        ...formData,
                        dateDeaccessioned: date || new Date(),
                      })
                    }
                    placeholder={t("form.dateDeaccessionedPlaceholder")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="method">{t("form.methodLabel")}</Label>
                  <Select
                    value={formData.method}
                    onValueChange={(
                      value: "sale" | "donation" | "destruction" | "transfer",
                    ) => setFormData({ ...formData, method: value })}
                  >
                    <SelectTrigger id="method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sale">
                        {t("form.methodSale")}
                      </SelectItem>
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
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">{t("form.reasonLabel")}</Label>
                <Input
                  id="reason"
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData({ ...formData, reason: e.target.value })
                  }
                  placeholder={t("form.reasonPlaceholder")}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="disposition">
                  {t("form.dispositionLabel")}
                </Label>
                <Input
                  id="disposition"
                  value={formData.disposition}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      disposition: e.target.value,
                    })
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
                  {t("actions.cancel")}
                </Button>
                <PermissionGate permission="collections.create">
                  <Button type="submit" disabled={isSubmitting}>
                    <Save className="mr-2 h-4 w-4" />
                    {isSubmitting ? t("actions.creating") : t("actions.create")}
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
