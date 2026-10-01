"use client";

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
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { CollectionSelector } from "@/components/collection-selector";
import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";

type TreatmentType =
  | "routine"
  | "stabilization"
  | "restoration"
  | "cleaning"
  | "repair"
  | "assessment"
  | "other";

export default function NewTreatmentPage() {
  const t = useScopedI18n("conservation");
  const { currentOrganizationId } = useOrganization();
  const { push } = useRouter();
  const createTreatment = useMutation(api.conservationTreatments.create);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    collectionId: "",
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !formData.collectionId ||
      !formData.treatmentType ||
      !formData.title ||
      !formData.description
    ) {
      toast.error(t("form.validationError"));
      return;
    }

    try {
      setIsSubmitting(true);
      const treatmentId = await createTreatment({
        collectionId: formData.collectionId as Id<"collections">,
        treatmentType: formData.treatmentType as TreatmentType,
        title: formData.title,
        description: formData.description,
        performedAt: formData.performedAt.getTime(),
        notes: formData.notes || undefined,
      });

      toast.success(t("form.createSuccess"));
      push(`/conservation/${treatmentId}`);
    } catch (error) {
      console.error(error);
      toast.error(t("form.createError"));
    } finally {
      setIsSubmitting(false);
    }
  };

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
            <Link href="/conservation">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {t("form.newTitle")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("form.newSubtitle")}
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
                {t("form.collectionObject")}{" "}
                <span className="text-red-500">*</span>
              </Label>
              {currentOrganizationId && (
                <CollectionSelector
                  organizationId={currentOrganizationId}
                  value={formData.collectionId}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, collectionId: value }))
                  }
                  required
                />
              )}
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

              <DatePicker
                label={
                  <>
                    {t("form.datePerformed")}{" "}
                    <span className="text-red-500">*</span>
                  </>
                }
                date={formData.performedAt}
                onSelect={(date) =>
                  date &&
                  setFormData((prev) => ({ ...prev, performedAt: date }))
                }
                className="w-full bg-muted/50 border-border text-foreground/80"
              />
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
              <Link href="/conservation">{t("form.cancel")}</Link>
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t("form.createRecord")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
