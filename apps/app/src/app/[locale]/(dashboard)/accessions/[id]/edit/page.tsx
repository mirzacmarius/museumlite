"use client";

import { Header } from "@/app/[locale]/(dashboard)/_components/header";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Textarea } from "@v1/ui/textarea";
import { Label } from "@v1/ui/label";
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
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function EditAccessionPage() {
  const params = useParams();
  const router = useRouter();
  const accessionId = params.id as string;
  const { currentOrganizationId } = useOrganization();
  const updateAccession = useMutation(api.accessions.update);

  const accession = useQuery(
    api.accessions.get,
    accessionId ? { accessionId: accessionId as Id<"accessions"> } : "skip",
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    source: "",
    method: "purchase" as "purchase" | "gift" | "loan" | "transfer" | "donation" | "other" | "bequest",
    cost: "",
    notes: "",
  });

  useEffect(() => {
    if (accession) {
      setFormData({
        source: accession.source || "",
        method: accession.method,
        cost: accession.cost?.toString() || "",
        notes: accession.notes || "",
      });
    }
  }, [accession]);

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">
          Please select an organization to edit accessions.
        </p>
      </div>
    );
  }

  if (accession === undefined) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (accession === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Accession not found</p>
      </div>
    );
  }

  if (accession.status !== "pending") {
    return (
      <>
        <Header title="Edit Accession" description="Update accession details" />
        <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
          <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
            <div className="flex w-full flex-col rounded-lg border border-border bg-card dark:bg-black">
              <div className="flex h-64 items-center justify-center">
                <div className="text-center">
                  <p className="text-muted-foreground">
                    Cannot edit accession that is not pending
                  </p>
                  <Button variant="outline" className="mt-4" asChild>
                    <Link href={`/accessions/${accessionId}`}>
                      Back to Accession
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.source.trim()) {
      setError("Source is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await updateAccession({
        accessionId: accessionId as Id<"accessions">,
        source: formData.source,
        method: formData.method,
        cost: formData.cost ? Number.parseFloat(formData.cost) : undefined,
        notes: formData.notes || undefined,
      });
      router.push(`/accessions/${accessionId}`);
    } catch (err) {
      console.error("Error updating accession:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update accession. Please try again.",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Header title="Edit Accession" description="Update accession details" />
      <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
        <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
          <div className="flex w-full flex-col rounded-lg border border-border bg-card dark:bg-black">
            <div className="flex w-full items-center justify-between rounded-lg border-b border-border p-6">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/accessions/${accessionId}`}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Accession
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
                <div className="space-y-2">
                  <Label>Accession Number</Label>
                  <Input
                    value={accession.accessionNumber}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Accession number cannot be changed
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Date Received</Label>
                  <Input
                    value={new Date(accession.dateReceived).toLocaleDateString()}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Date received cannot be changed
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="source">
                    Source *
                  </Label>
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
                  <Label htmlFor="method">
                    Method *
                  </Label>
                  <Select
                    value={formData.method}
                    onValueChange={(value: "purchase" | "gift" | "loan" | "transfer" | "donation" | "other" | "bequest") =>
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
                      <SelectItem value="donation">Donation</SelectItem>
                      <SelectItem value="bequest">Bequest</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cost">
                    Cost
                  </Label>
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
                  <Label htmlFor="notes">
                    Notes
                  </Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    placeholder="Additional notes about this accession..."
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
                  <PermissionGate permission="collections.update">
                    <Button type="submit" disabled={isSubmitting}>
                      <Save className="mr-2 h-4 w-4" />
                      {isSubmitting ? "Updating..." : "Update Accession"}
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

