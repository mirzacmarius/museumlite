"use client";

import { Header } from "@/app/[locale]/(dashboard)/_components/header";
import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewDeaccessionPage() {
  const router = useRouter();
  const { currentOrganizationId } = useOrganization();
  const createDeaccession = useMutation(api.deaccessions.create);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    collectionId: "",
    deaccessionNumber: "",
    dateDeaccessioned: new Date().toISOString().split("T")[0],
    reason: "",
    method: "sale" as "sale" | "donation" | "destruction" | "transfer",
    disposition: "",
    notes: "",
  });

  const collections = useQuery(
    api.collections.list,
    currentOrganizationId
      ? {
          organizationId: currentOrganizationId as any,
          paginationOpts: { numItems: 1000, cursor: null },
        }
      : "skip",
  );

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
    if (!formData.collectionId.trim()) {
      alert("Collection is required");
      return;
    }
    if (!formData.reason.trim()) {
      alert("Reason is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await createDeaccession({
        organizationId: currentOrganizationId as any,
        collectionId: formData.collectionId as any,
        deaccessionNumber:
          formData.deaccessionNumber || undefined,
        dateDeaccessioned: new Date(
          formData.dateDeaccessioned,
        ).getTime(),
        reason: formData.reason,
        method: formData.method,
        disposition: formData.disposition || undefined,
        notes: formData.notes || undefined,
      });
      router.push("/deaccessions");
    } catch (error) {
      console.error("Error creating deaccession:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to create deaccession. Please try again.",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Header
        title="New Deaccession"
        description="Create a new deaccession record"
      />
      <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
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
              <div className="mx-auto max-w-2xl space-y-6">
                <div className="space-y-2">
                  <label htmlFor="collectionId" className="text-sm font-medium">
                    Collection Object *
                  </label>
                  <Select
                    value={formData.collectionId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, collectionId: value })
                    }
                  >
                    <SelectTrigger id="collectionId">
                      <SelectValue placeholder="Select a collection object" />
                    </SelectTrigger>
                    <SelectContent>
                      {collections?.page.map((collection) => (
                        <SelectItem
                          key={collection._id}
                          value={collection._id}
                        >
                          {collection.accessionNumber} - {collection.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Select the collection object to deaccession
                  </p>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="deaccessionNumber"
                    className="text-sm font-medium"
                  >
                    Deaccession Number
                  </label>
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
                    <label
                      htmlFor="dateDeaccessioned"
                      className="text-sm font-medium"
                    >
                      Date Deaccessioned *
                    </label>
                    <Input
                      id="dateDeaccessioned"
                      type="date"
                      value={formData.dateDeaccessioned}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          dateDeaccessioned: e.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="method" className="text-sm font-medium">
                      Method *
                    </label>
                    <Select
                      value={formData.method}
                      onValueChange={(value: any) =>
                        setFormData({ ...formData, method: value })
                      }
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
                  <label htmlFor="reason" className="text-sm font-medium">
                    Reason *
                  </label>
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
                  <label htmlFor="disposition" className="text-sm font-medium">
                    Disposition
                  </label>
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
                  <label htmlFor="notes" className="text-sm font-medium">
                    Notes
                  </label>
                  <textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    placeholder="Additional notes about this deaccession..."
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
    </>
  );
}

