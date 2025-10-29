"use client";

import { Header } from "@/app/[locale]/(dashboard)/_components/header";
import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

interface CollectionFormData {
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
}

export default function CollectionEditPage() {
  const params = useParams();
  const router = useRouter();
  const collectionId = params.id as string;
  const { currentOrganizationId } = useOrganization();
  const updateCollection = useMutation(api.collections.update);

  const collection = useQuery(
    api.collections.get,
    collectionId ? { collectionId: collectionId as any } : "skip",
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
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
  });

  // Load existing data
  useEffect(() => {
    if (collection) {
      setFormData({
        title: collection.title,
        objectType: collection.objectType || "",
        objectName: collection.objectName || "",
        culture: collection.culture || "",
        period: collection.period || "",
        dateCreated: collection.dateCreated || "",
        materials: collection.materials || "",
        dimensions: collection.dimensions || "",
        description: collection.description || "",
        condition: collection.condition || "",
        provenance: collection.provenance || "",
        exhibitionHistory: collection.exhibitionHistory || "",
      });
    }
  }, [collection]);

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">
          Please select an organization to edit collections.
        </p>
      </div>
    );
  }

  if (collection === undefined) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (collection === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Collection not found</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert("Title is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await updateCollection({
        collectionId: collectionId as any,
        ...formData,
      });
      router.push(`/collections/${collectionId}`);
    } catch (error) {
      console.error("Error updating collection:", error);
      alert("Failed to update collection. Please try again.");
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
        title="Edit Collection"
        description={`Editing: ${collection.title}`}
      />
      <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
        <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
          <div className="flex w-full flex-col rounded-lg border border-border bg-card dark:bg-black">
            <div className="flex w-full items-center justify-between rounded-lg p-6">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/collections/${collectionId}`}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Link>
                </Button>
                <h2 className="text-xl font-medium text-primary">
                  Edit Collection
                </h2>
              </div>
            </div>

            <div className="flex w-full px-6">
              <div className="w-full border-b border-border" />
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={formData.title}
                      onChange={(e) => updateField("title", e.target.value)}
                      placeholder="Enter object title"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Accession Number
                    </label>
                    <Input
                      value={collection.accessionNumber}
                      disabled
                      className="bg-muted"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Accession number cannot be changed
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Object Type
                    </label>
                    <Input
                      value={formData.objectType || ""}
                      onChange={(e) => updateField("objectType", e.target.value)}
                      placeholder="e.g., Painting, Sculpture"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Object Name
                    </label>
                    <Input
                      value={formData.objectName || ""}
                      onChange={(e) => updateField("objectName", e.target.value)}
                      placeholder="e.g., Portrait"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Culture
                    </label>
                    <Input
                      value={formData.culture || ""}
                      onChange={(e) => updateField("culture", e.target.value)}
                      placeholder="e.g., French"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Period
                    </label>
                    <Input
                      value={formData.period || ""}
                      onChange={(e) => updateField("period", e.target.value)}
                      placeholder="e.g., 19th Century"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Date Created
                    </label>
                    <Input
                      value={formData.dateCreated || ""}
                      onChange={(e) =>
                        updateField("dateCreated", e.target.value)
                      }
                      placeholder="e.g., 1850"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Materials
                    </label>
                    <Input
                      value={formData.materials || ""}
                      onChange={(e) => updateField("materials", e.target.value)}
                      placeholder="e.g., Oil on canvas"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Dimensions
                    </label>
                    <Input
                      value={formData.dimensions || ""}
                      onChange={(e) =>
                        updateField("dimensions", e.target.value)
                      }
                      placeholder="e.g., 50 x 60 cm"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Description
                  </label>
                  <textarea
                    value={formData.description || ""}
                    onChange={(e) => updateField("description", e.target.value)}
                    rows={4}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Enter detailed description"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Condition
                  </label>
                  <Input
                    value={formData.condition || ""}
                    onChange={(e) => updateField("condition", e.target.value)}
                    placeholder="e.g., Excellent, Good, Fair"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Provenance
                  </label>
                  <textarea
                    value={formData.provenance || ""}
                    onChange={(e) => updateField("provenance", e.target.value)}
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Enter provenance information"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Exhibition History
                  </label>
                  <textarea
                    value={formData.exhibitionHistory || ""}
                    onChange={(e) =>
                      updateField("exhibitionHistory", e.target.value)
                    }
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Enter exhibition history"
                  />
                </div>

                <div className="flex justify-end gap-4">
                  <Button type="button" variant="outline" asChild>
                    <Link href={`/collections/${collectionId}`}>Cancel</Link>
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    <Save className="mr-2 h-4 w-4" />
                    {isSubmitting ? "Updating..." : "Update Collection"}
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

