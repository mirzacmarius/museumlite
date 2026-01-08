"use client";

import { useOrganization } from "@/components/organization-provider";
import { CollectionSelector } from "@/components/collection-selector";
import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { DatePicker } from "@v1/ui/date-picker";
import { useMutation } from "convex/react";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { Id } from "@v1/backend/convex/_generated/dataModel";

type TreatmentType =
  | "routine"
  | "stabilization"
  | "restoration"
  | "cleaning"
  | "repair"
  | "assessment"
  | "other";

const TREATMENT_TYPES: { value: TreatmentType; label: string }[] = [
  { value: "routine", label: "Routine Maintenance" },
  { value: "stabilization", label: "Stabilization" },
  { value: "restoration", label: "Restoration" },
  { value: "cleaning", label: "Cleaning" },
  { value: "repair", label: "Repair" },
  { value: "assessment", label: "Condition Assessment" },
  { value: "other", label: "Other" },
];

export default function NewTreatmentPage() {
  const { currentOrganizationId } = useOrganization();
  const router = useRouter();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !formData.collectionId ||
      !formData.treatmentType ||
      !formData.title ||
      !formData.description
    ) {
      toast.error("Please fill in all required fields");
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

      toast.success("Treatment record created");
      router.push(`/conservation/${treatmentId}`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to create treatment record");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-full w-full bg-background px-6 py-8">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <Link href="/conservation">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              New Treatment Record
            </h1>
            <p className="text-sm text-muted-foreground">
              Log a new conservation treatment or assessment
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
                Collection Object <span className="text-red-500">*</span>
              </Label>
              {currentOrganizationId && (
                <CollectionSelector
                  organizationId={currentOrganizationId}
                  value={formData.collectionId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, collectionId: value })
                  }
                  required
                />
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-foreground/80">
                  Treatment Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.treatmentType}
                  onValueChange={(value) =>
                    setFormData({ ...formData, treatmentType: value })
                  }
                >
                  <SelectTrigger className="bg-muted/50 border-border text-foreground/80">
                    <SelectValue placeholder="Select type" />
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
                  Date Performed <span className="text-red-500">*</span>
                </Label>
                <DatePicker
                  date={formData.performedAt}
                  onSelect={(date) =>
                    date && setFormData({ ...formData, performedAt: date })
                  }
                  className="w-full bg-muted/50 border-border text-foreground/80"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground/80">
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="e.g. Surface Cleaning"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className="bg-muted/50 border-border text-foreground/80 placeholder:text-muted-foreground"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground/80">
                Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                placeholder="Detailed description of the treatment performed..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="min-h-[120px] bg-muted/50 border-border text-foreground/80 placeholder:text-muted-foreground"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground/80">Additional Notes</Label>
              <Textarea
                placeholder="Any observations, materials used, or recommendations..."
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
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
              <Link href="/conservation">Cancel</Link>
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Record
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
