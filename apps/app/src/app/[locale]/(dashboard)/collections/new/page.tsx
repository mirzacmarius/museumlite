"use client";

import { Header } from "@/app/[locale]/(dashboard)/_components/header";
import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Textarea } from "@v1/ui/textarea";
import { Label } from "@v1/ui/label";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { LocationSelector } from "@/components/location-selector";
import { useMutation } from "convex/react";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Id } from "@v1/backend/convex/_generated/dataModel";

interface CollectionFormData {
  accessionNumber?: string;
  title: string;
  objectType?: string;
  objectName?: string;
  culture?: string;
  period?: string;
  dateCreated?: string;
  materials?: string;
  dimensions?: string;
  description?: string;
  condition?: string;
  provenance?: string;
  exhibitionHistory?: string;
  currentLocationId?: Id<"locations">;
}

export default function CollectionFormPage() {
  const router = useRouter();
  const { currentOrganizationId } = useOrganization();
  const createCollection = useMutation(api.collections.create);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CollectionFormData>({
    title: "",
    objectType: "",
    objectName: "",
    culture: "",
    period: "",
    dateCreated: "",
    materials: "",
    dimensions: "",
    description: "",
    condition: "",
    provenance: "",
    exhibitionHistory: "",
    currentLocationId: undefined,
  });


  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">
          Please select an organization to create collections.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.title.trim()) {
      setError("Title is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await createCollection({
        organizationId: currentOrganizationId,
        ...formData,
        currentLocationId: formData.currentLocationId
          ? (formData.currentLocationId as Id<"locations">)
          : undefined,
      });
      router.push("/collections");
    } catch (err) {
      console.error("Error saving collection:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save collection. Please try again.",
      );
      setIsSubmitting(false);
    }
  };

  const updateField = (
    field: keyof CollectionFormData,
    value: string,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <>
      <Header
        title="New Collection"
        description="Create a new collection object"
      />
      <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
        <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
          <div className="flex w-full flex-col rounded-lg border border-border bg-card dark:bg-black">
            <div className="flex w-full items-center justify-between rounded-lg p-6">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/collections">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Link>
                </Button>
                <h2 className="text-xl font-medium text-primary">
                  New Collection
                </h2>
              </div>
            </div>

            <div className="flex w-full px-6">
              <div className="w-full border-b border-border" />
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              {error && (
                <div className="mb-6 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <Label htmlFor="title">
                      Title <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => updateField("title", e.target.value)}
                      placeholder="Enter object title"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="accessionNumber">
                      Accession Number
                    </Label>
                    <Input
                      id="accessionNumber"
                      value={formData.accessionNumber || ""}
                      onChange={(e) =>
                        updateField("accessionNumber", e.target.value)
                      }
                      placeholder="Auto-generated if not provided"
                    />
                  </div>

                  <div>
                    <Label htmlFor="objectType">
                      Object Type
                    </Label>
                    <Input
                      id="objectType"
                      value={formData.objectType || ""}
                      onChange={(e) => updateField("objectType", e.target.value)}
                      placeholder="e.g., Painting, Sculpture"
                    />
                  </div>

                  <div>
                    <Label htmlFor="objectName">
                      Object Name
                    </Label>
                    <Input
                      id="objectName"
                      value={formData.objectName || ""}
                      onChange={(e) => updateField("objectName", e.target.value)}
                      placeholder="e.g., Portrait"
                    />
                  </div>

                  <div>
                    <Label htmlFor="culture">
                      Culture
                    </Label>
                    <Input
                      id="culture"
                      value={formData.culture || ""}
                      onChange={(e) => updateField("culture", e.target.value)}
                      placeholder="e.g., French"
                    />
                  </div>

                  <div>
                    <Label htmlFor="period">
                      Period
                    </Label>
                    <Input
                      id="period"
                      value={formData.period || ""}
                      onChange={(e) => updateField("period", e.target.value)}
                      placeholder="e.g., 19th Century"
                    />
                  </div>

                  <div>
                    <Label htmlFor="dateCreated">
                      Date Created
                    </Label>
                    <Input
                      id="dateCreated"
                      value={formData.dateCreated || ""}
                      onChange={(e) =>
                        updateField("dateCreated", e.target.value)
                      }
                      placeholder="e.g., 1850"
                    />
                  </div>

                  <div>
                    <Label htmlFor="materials">
                      Materials
                    </Label>
                    <Input
                      id="materials"
                      value={formData.materials || ""}
                      onChange={(e) => updateField("materials", e.target.value)}
                      placeholder="e.g., Oil on canvas"
                    />
                  </div>

                  <div>
                    <Label htmlFor="dimensions">
                      Dimensions
                    </Label>
                    <Input
                      id="dimensions"
                      value={formData.dimensions || ""}
                      onChange={(e) =>
                        updateField("dimensions", e.target.value)
                      }
                      placeholder="e.g., 50 x 60 cm"
                    />
                  </div>

                  <div>
                    <Label htmlFor="condition">
                      Condition
                    </Label>
                    <Input
                      id="condition"
                      value={formData.condition || ""}
                      onChange={(e) => updateField("condition", e.target.value)}
                      placeholder="e.g., Excellent, Good, Fair"
                    />
                  </div>

                  <div>
                    <Label htmlFor="currentLocationId">
                      Location
                    </Label>
                    <LocationSelector
                      organizationId={currentOrganizationId}
                      value={formData.currentLocationId}
                      onValueChange={(value) =>
                        updateField("currentLocationId", value)
                      }
                      placeholder="Select a location (optional)"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description || ""}
                    onChange={(e) => updateField("description", e.target.value)}
                    rows={4}
                    placeholder="Enter detailed description"
                  />
                </div>

                <div>
                  <Label htmlFor="provenance">
                    Provenance
                  </Label>
                  <Textarea
                    id="provenance"
                    value={formData.provenance || ""}
                    onChange={(e) => updateField("provenance", e.target.value)}
                    rows={3}
                    placeholder="Enter provenance information"
                  />
                </div>

                <div>
                  <Label htmlFor="exhibitionHistory">
                    Exhibition History
                  </Label>
                  <Textarea
                    id="exhibitionHistory"
                    value={formData.exhibitionHistory || ""}
                    onChange={(e) =>
                      updateField("exhibitionHistory", e.target.value)
                    }
                    rows={3}
                    placeholder="Enter exhibition history"
                  />
                </div>

                <div className="flex justify-end gap-4">
                  <Button type="button" variant="outline" asChild>
                    <Link href="/collections">Cancel</Link>
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    <Save className="mr-2 h-4 w-4" />
                    {isSubmitting ? "Creating..." : "Create Collection"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
