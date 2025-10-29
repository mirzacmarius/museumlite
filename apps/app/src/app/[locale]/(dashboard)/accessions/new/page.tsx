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
import { useMutation } from "convex/react";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewAccessionPage() {
  const router = useRouter();
  const { currentOrganizationId } = useOrganization();
  const createAccession = useMutation(api.accessions.create);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    accessionNumber: "",
    dateReceived: new Date().toISOString().split("T")[0],
    source: "",
    method: "purchase" as "purchase" | "gift" | "loan" | "transfer",
    cost: "",
    notes: "",
  });

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">
          Please select an organization to create accessions.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.source.trim()) {
      alert("Source is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await createAccession({
        organizationId: currentOrganizationId as any,
        accessionNumber:
          formData.accessionNumber || undefined,
        dateReceived: new Date(formData.dateReceived).getTime(),
        source: formData.source,
        method: formData.method,
        cost: formData.cost ? parseFloat(formData.cost) : undefined,
        notes: formData.notes || undefined,
      });
      router.push("/accessions");
    } catch (error) {
      console.error("Error creating accession:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to create accession. Please try again.",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Header
        title="New Accession"
        description="Create a new accession record"
      />
      <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
        <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
          <div className="flex w-full flex-col rounded-lg border border-border bg-card dark:bg-black">
            <div className="flex w-full items-center justify-between rounded-lg border-b border-border p-6">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/accessions">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Accessions
                </Link>
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="mx-auto max-w-2xl space-y-6">
                <div className="space-y-2">
                  <label htmlFor="accessionNumber" className="text-sm font-medium">
                    Accession Number
                  </label>
                  <Input
                    id="accessionNumber"
                    value={formData.accessionNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, accessionNumber: e.target.value })
                    }
                    placeholder="Auto-generated if left empty"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to auto-generate based on organization format
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="dateReceived" className="text-sm font-medium">
                      Date Received *
                    </label>
                    <Input
                      id="dateReceived"
                      type="date"
                      value={formData.dateReceived}
                      onChange={(e) =>
                        setFormData({ ...formData, dateReceived: e.target.value })
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
                        <SelectItem value="purchase">Purchase</SelectItem>
                        <SelectItem value="gift">Gift</SelectItem>
                        <SelectItem value="loan">Loan</SelectItem>
                        <SelectItem value="transfer">Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="source" className="text-sm font-medium">
                    Source *
                  </label>
                  <Input
                    id="source"
                    value={formData.source}
                    onChange={(e) =>
                      setFormData({ ...formData, source: e.target.value })
                    }
                    placeholder="e.g., Private collector, Auction house"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="cost" className="text-sm font-medium">
                    Cost
                  </label>
                  <Input
                    id="cost"
                    type="number"
                    step="0.01"
                    value={formData.cost}
                    onChange={(e) =>
                      setFormData({ ...formData, cost: e.target.value })
                    }
                    placeholder="0.00"
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
                    placeholder="Additional notes about this accession..."
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
                      {isSubmitting ? "Creating..." : "Create Accession"}
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

