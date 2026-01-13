"use client";

import { useOrganization } from "@/components/organization-provider";
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
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewCollectionPage() {
  const router = useRouter();
  const { currentOrganizationId } = useOrganization();
  const createGroup = useMutation(api.collectionGroups.create);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    curatorId: "" as string | Id<"users">,
  });

  const members = useQuery(
    api.organizations.listOrganizationUsers,
    currentOrganizationId ? { organizationId: currentOrganizationId } : "skip",
  );

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
    if (!formData.name.trim()) {
      setError("Name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await createGroup({
        organizationId: currentOrganizationId,
        name: formData.name,
        description: formData.description,
        curatorId: formData.curatorId
          ? (formData.curatorId as Id<"users">)
          : undefined,
      });
      router.push("/collections");
    } catch (err) {
      console.error("Error creating collection:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create collection. Please try again.",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-full w-full bg-background px-6">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-md gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
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

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Ancient Egyptian Artifacts"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Describe this collection..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="curator">Curator</Label>
              <Select
                value={formData.curatorId}
                onValueChange={(value) =>
                  setFormData({ ...formData, curatorId: value })
                }
              >
                <SelectTrigger id="curator">
                  <SelectValue placeholder="Select a curator (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {members?.map((member) => (
                    <SelectItem key={member._id} value={member._id}>
                      {member.name || member.email || "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" variant="outline" asChild>
                <Link href="/collections">Cancel</Link>
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                <Save className="mr-2 h-4 w-4" />
                {isSubmitting ? "Creating..." : "Create Collection"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
