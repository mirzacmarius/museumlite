"use client";

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
        <p className="text-muted-foreground">
          Please select an organization to create deaccessions.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.collectionId.trim()) {
      setError("Collection is required");
      return;
    }
    if (!formData.reason.trim()) {
      setError("Reason is required");
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
        err instanceof Error
          ? err.message
          : "Failed to create deaccession. Please try again.",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-full w-full bg-secondary px-6 dark:bg-black">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card dark:bg-black">
          <div className="flex w-full items-center justify-between rounded-lg border-b border-border p-6">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/deaccessions">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Deaccessions
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
                placeholder="Select a collection object"
                label="Collection Object"
                required
                excludeDeaccessioned
              />

              <div className="space-y-2">
                <Label htmlFor="deaccessionNumber">Deaccession Number</Label>
                <Input
                  id="deaccessionNumber"
                  value={formData.deaccessionNumber}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      deaccessionNumber: e.target.value,
                    })
                  }
                  placeholder="Auto-generated if left empty"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to auto-generate based on organization format
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dateDeaccessioned">
                    Date Deaccessioned *
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
                    placeholder="Select date deaccessioned"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="method">Method *</Label>
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
                      <SelectItem value="sale">Sale</SelectItem>
                      <SelectItem value="donation">Donation</SelectItem>
                      <SelectItem value="destruction">Destruction</SelectItem>
                      <SelectItem value="transfer">Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason *</Label>
                <Input
                  id="reason"
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData({ ...formData, reason: e.target.value })
                  }
                  placeholder="e.g., No longer fits collection mission"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="disposition">Disposition</Label>
                <Input
                  id="disposition"
                  value={formData.disposition}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      disposition: e.target.value,
                    })
                  }
                  placeholder="e.g., Sold to private collector"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Additional notes about this deaccession..."
                  rows={4}
                />
              </div>

              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                >
                  Cancel
                </Button>
                <PermissionGate permission="collections.create">
                  <Button type="submit" disabled={isSubmitting}>
                    <Save className="mr-2 h-4 w-4" />
                    {isSubmitting ? "Creating..." : "Create Deaccession"}
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
