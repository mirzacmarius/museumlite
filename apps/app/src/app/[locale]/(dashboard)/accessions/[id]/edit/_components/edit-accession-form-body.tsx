"use client";

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
import { Save } from "lucide-react";
import { PermissionGate } from "@/components/permission-gate";
import { useI18n, useScopedI18n } from "@/locales/client";
import { EditSection } from "./edit-accession-ui";
export interface EditAccessionFormData {
  source: string;
  method:
    | "purchase"
    | "gift"
    | "loan"
    | "transfer"
    | "donation"
    | "other"
    | "bequest";
  cost: string;
  notes: string;
}

interface EditAccessionFormBodyProps {
  accessionNumber: string;
  dateReceivedLabel: string;
  formData: EditAccessionFormData;
  setFormData: React.Dispatch<React.SetStateAction<EditAccessionFormData>>;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export function EditAccessionFormBody({
  accessionNumber,
  dateReceivedLabel,
  formData,
  setFormData,
  error,
  isSubmitting,
  onSubmit,
  onCancel,
}: EditAccessionFormBodyProps) {
  const tRoot = useI18n();
  const t = useScopedI18n("accessions");
  const tCommon = useScopedI18n("common");

  return (
    <form
      id="accession-edit-form"
      onSubmit={onSubmit}
      className="rounded-2xl border border-border/60 bg-background/70 px-5 py-6 shadow-sm sm:px-8 sm:py-8"
    >
      {error ? (
        <div className="mb-6 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="space-y-8">
        <EditSection
          title={tRoot(
            "untranslatedRecords.accessions.edit.lockedIntakeDetails",
          )}
          description={tRoot(
            "untranslatedRecords.accessions.edit.lockedDetailsDescription",
          )}
        >
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("form.accessionNumber")}</Label>
              <Input value={accessionNumber} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">
                {t("detail.accessionNumberCannotChange")}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{t("form.dateReceived")}</Label>
              <Input value={dateReceivedLabel} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">
                {t("detail.dateReceivedCannotChange")}
              </p>
            </div>
          </div>
        </EditSection>

        <EditSection
          title={tRoot(
            "untranslatedRecords.accessions.edit.accessionInformation",
          )}
          description={tRoot(
            "untranslatedRecords.accessions.edit.accessionDescription",
          )}
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
                  setFormData((prev) => ({
                    ...prev,
                    source: e.target.value,
                  }))
                }
                placeholder={t("form.sourcePlaceholder")}
                required
              />
              <p className="text-xs text-muted-foreground">
                {tRoot(
                  "untranslatedRecords.accessions.edit.sourceNameGuidance",
                )}
              </p>
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
                ) => setFormData((prev) => ({ ...prev, method: value }))}
              >
                <SelectTrigger id="method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase">
                    {t("form.methods.purchase")}
                  </SelectItem>
                  <SelectItem value="gift">{t("form.methods.gift")}</SelectItem>
                  <SelectItem value="loan">{t("form.methods.loan")}</SelectItem>
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
              <p className="text-xs text-muted-foreground">
                {tRoot(
                  "untranslatedRecords.accessions.edit.methodInterpretation",
                )}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cost">{t("form.cost")}</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                value={formData.cost}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, cost: e.target.value }))
                }
                placeholder={t("form.costPlaceholder")}
              />
              <p className="text-xs text-muted-foreground">
                {tRoot("untranslatedRecords.accessions.edit.noCostHint")}
              </p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">{t("form.notes")}</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder={t("form.notesPlaceholder")}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                {tRoot("untranslatedRecords.accessions.edit.notesGuidanceLong")}
              </p>
            </div>
          </div>
        </EditSection>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            {tCommon("cancel")}
          </Button>
          <PermissionGate permission="collections.update">
            <Button type="submit" disabled={isSubmitting}>
              <Save className="mr-2 size-4" />
              {isSubmitting ? t("form.updating") : t("form.updateAccession")}
            </Button>
          </PermissionGate>
        </div>
      </div>
    </form>
  );
}
