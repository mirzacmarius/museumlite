"use client";

import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
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
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { toast } from "sonner";

type TreatmentType =
  | "routine"
  | "stabilization"
  | "restoration"
  | "cleaning"
  | "repair"
  | "assessment"
  | "other";

export default function EditTreatmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = useScopedI18n("conservation");
  const { id } = use(params);
  const { push } = useRouter();
  const treatment = useQuery(api.conservationTreatments.get, {
    id: id as Id<"conservationTreatments">,
  });
  const updateTreatment = useMutation(api.conservationTreatments.update);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    treatmentType: "",
    title: "",
    description: "",
    performedAt: new Date(),
    notes: "",
  });

  const TREATMENT_TYPES: { value: TreatmentType; label: string }[] = [
    { value: "routine", label: t("treatmentTypes.routine") },
    { value: "stabilization", label: t("treatmentTypes.stabilization") },
    { value: "restoration", label: t("treatmentTypes.restoration") },
    { value: "cleaning", label: t("treatmentTypes.cleaning") },
    { value: "repair", label: t("treatmentTypes.repair") },
    { value: "assessment", label: t("treatmentTypes.assessment") },
    { value: "other", label: t("treatmentTypes.other") },
  ];

  useEffect(() => {
    if (treatment) {
      setFormData({
        treatmentType: treatment.treatmentType,
        title: treatment.title,
        description: treatment.description,
        performedAt: new Date(treatment.performedAt),
        notes: treatment.notes || "",
      });
    }
  }, [treatment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.treatmentType || !formData.title || !formData.description) {
      toast.error(t("form.validationError"));
      return;
    }

    try {
      setIsSubmitting(true);
      await updateTreatment({
        id: id as Id<"conservationTreatments">,
        treatmentType: formData.treatmentType as TreatmentType,
        title: formData.title,
        description: formData.description,
        performedAt: formData.performedAt.getTime(),
        notes: formData.notes || undefined,
      });

      toast.success(t("form.updateSuccess"));
      push(`/conservation/${id}`);
    } catch (error) {
      console.error(error);
      toast.error(t("form.updateError"));
    } finally {
      setIsSubmitting(false);
    }
  };

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

  return (
    <div className="flex size-full bg-background px-6 py-8">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <Link href={`/conservation/${id}`}>
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {t("form.editTitle")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("form.editSubtitle")} {treatment.title}
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-8 rounded-xl border border-border bg-card p-6"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground/80">
                {t("form.collectionObject")}
              </Label>
              <div className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                {treatment.collectionTitle || t("detail.unknownObject")}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-foreground/80">
                  {t("form.treatmentType")}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.treatmentType}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, treatmentType: value }))
                  }
                >
                  <SelectTrigger className="bg-muted/50 border-border text-foreground/80">
                    <SelectValue placeholder={t("form.selectType")} />
                  </SelectTrigger>
                  <SelectContent>
                    {TREATMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground/80">
                  {t("form.datePerformed")}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <DatePicker
                  date={formData.performedAt}
                  onSelect={(date) =>
                    date &&
                    setFormData((prev) => ({ ...prev, performedAt: date }))
                  }
                  className="w-full bg-muted/50 border-border text-foreground/80"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground/80">
                {t("form.title")} <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder={t("form.titlePlaceholder")}
                value={formData.title}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, title: e.target.value }))
                }
                className="bg-muted/50 border-border text-foreground/80 placeholder:text-muted-foreground"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground/80">
                {t("form.description")} <span className="text-red-500">*</span>
              </Label>
              <Textarea
                placeholder={t("form.descriptionPlaceholder")}
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                className="min-h-[120px] bg-muted/50 border-border text-foreground/80 placeholder:text-muted-foreground"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground/80">
                {t("form.additionalNotes")}
              </Label>
              <Textarea
                placeholder={t("form.notesPlaceholder")}
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
                className="min-h-[100px] bg-muted/50 border-border text-foreground/80 placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t border-border/50">
            <Button
              type="button"
              variant="ghost"
              asChild
              className="text-muted-foreground hover:text-foreground"
            >
              <Link href={`/conservation/${id}`}>{t("form.cancel")}</Link>
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t("form.saveChanges")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
