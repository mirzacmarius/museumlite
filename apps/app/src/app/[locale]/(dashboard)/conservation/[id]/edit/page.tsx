"use client";

import { useOrganization } from "@/components/organization-provider";
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
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, use } from "react";
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

export default function EditTreatmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
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
      toast.error("Please fill in all required fields");
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

      toast.success("Treatment record updated");
      router.push(`/conservation/${id}`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to update treatment record");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (treatment === undefined) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-zinc-950">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (treatment === null) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-zinc-950">
        <p className="text-zinc-500">Treatment record not found</p>
        <Button asChild variant="outline">
          <Link href="/conservation">Back to List</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-zinc-950 px-6 py-8">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
          >
            <Link href={`/conservation/${id}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-zinc-100">
              Edit Treatment Record
            </h1>
            <p className="text-sm text-zinc-400">
              Update details for {treatment.title}
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-8 rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-6"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">Collection Object</Label>
              <div className="rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-400">
                {treatment.collectionTitle || "Unknown Object"}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-zinc-300">
                  Treatment Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.treatmentType}
                  onValueChange={(value) =>
                    setFormData({ ...formData, treatmentType: value })
                  }
                >
                  <SelectTrigger className="bg-zinc-900/50 border-zinc-800 text-zinc-300">
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
                <Label className="text-zinc-300">
                  Date Performed <span className="text-red-500">*</span>
                </Label>
                <DatePicker
                  date={formData.performedAt}
                  onSelect={(date) =>
                    date && setFormData({ ...formData, performedAt: date })
                  }
                  className="w-full bg-zinc-900/50 border-zinc-800 text-zinc-300"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300">
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="e.g. Surface Cleaning"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className="bg-zinc-900/50 border-zinc-800 text-zinc-300 placeholder:text-zinc-600"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300">
                Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                placeholder="Detailed description of the treatment performed..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="min-h-[120px] bg-zinc-900/50 border-zinc-800 text-zinc-300 placeholder:text-zinc-600"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300">Additional Notes</Label>
              <Textarea
                placeholder="Any observations, materials used, or recommendations..."
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                className="min-h-[100px] bg-zinc-900/50 border-zinc-800 text-zinc-300 placeholder:text-zinc-600"
              />
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t border-zinc-800/50">
            <Button
              type="button"
              variant="ghost"
              asChild
              className="text-zinc-400 hover:text-zinc-100"
            >
              <Link href={`/conservation/${id}`}>Cancel</Link>
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
