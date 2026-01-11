"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
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
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type DeaccessionMethod = "sale" | "donation" | "destruction" | "transfer";

export default function EditDeaccessionPage() {
  const params = useParams();
  const router = useRouter();
  const deaccessionId = params.id as string;
  const { currentOrganizationId } = useOrganization();
  const updateDeaccession = useMutation(api.deaccessions.update);

  const deaccession = useQuery(
    api.deaccessions.get,
    deaccessionId
      ? { deaccessionId: deaccessionId as Id<"deaccessions"> }
      : "skip",
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    reason: "",
    method: "sale" as DeaccessionMethod,
    disposition: "",
    notes: "",
    proceedsAmount: "",
    proceedsCurrency: "USD",
    proceedsRecipient: "",
    proceedsDate: "",
    proceedsNotes: "",
  });

  useEffect(() => {
    if (deaccession) {
      setFormData({
        reason: deaccession.reason || "",
        method: deaccession.method,
        disposition: deaccession.disposition || "",
        notes: deaccession.notes || "",
        proceedsAmount: deaccession.proceedsAmount?.toString() || "",
        proceedsCurrency: deaccession.proceedsCurrency || "USD",
        proceedsRecipient: deaccession.proceedsRecipient || "",
        proceedsDate: deaccession.proceedsDate
          ? new Date(deaccession.proceedsDate).toISOString().slice(0, 10)
          : "",
        proceedsNotes: deaccession.proceedsNotes || "",
      });
    }
  }, [deaccession]);

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">
          Please select an organization to edit deaccessions.
        </p>
      </div>
    );
  }

  if (deaccession === undefined) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (deaccession === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Deaccession not found</p>
      </div>
    );
  }

  if (deaccession.status !== "pending") {
    return (
      <div className="flex h-full w-full bg-background px-6">
        <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
          <div className="flex w-full flex-col rounded-lg border border-border bg-card">
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <p className="text-muted-foreground">
                  Cannot edit deaccession that is not pending
                </p>
                <Button variant="outline" className="mt-4" asChild>
                  <Link href={`/deaccessions/${deaccessionId}`}>
                    Back to Deaccession
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.reason.trim()) {
      setError("Reason is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await updateDeaccession({
        deaccessionId: deaccessionId as Id<"deaccessions">,
        reason: formData.reason,
        method: formData.method,
        disposition: formData.disposition || undefined,
        notes: formData.notes || undefined,
        proceedsAmount: formData.proceedsAmount
          ? Number.parseFloat(formData.proceedsAmount)
          : undefined,
        proceedsCurrency: formData.proceedsCurrency || undefined,
        proceedsRecipient: formData.proceedsRecipient || undefined,
        proceedsDate: formData.proceedsDate
          ? new Date(formData.proceedsDate).getTime()
          : undefined,
        proceedsNotes: formData.proceedsNotes || undefined,
      });
      router.push(`/deaccessions/${deaccessionId}`);
    } catch (err) {
      console.error("Error updating deaccession:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update deaccession. Please try again.",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-full w-full bg-background px-6">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <div className="flex w-full items-center justify-between rounded-lg border-b border-border p-6">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/deaccessions/${deaccessionId}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Deaccession
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
                <Label>Deaccession Number</Label>
                <Input
                  value={deaccession.deaccessionNumber}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Deaccession number cannot be changed
                </p>
              </div>

              <div className="space-y-2">
                <Label>Date Deaccessioned</Label>
                <Input
                  value={new Date(
                    deaccession.dateDeaccessioned,
                  ).toLocaleDateString()}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Date deaccessioned cannot be changed
                </p>
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
                <Label htmlFor="method">Method *</Label>
                <Select
                  value={formData.method}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      method: value as DeaccessionMethod,
                    })
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

              {formData.method === "sale" && (
                <div className="border-t border-border pt-6 mt-6">
                  <h3 className="text-sm font-medium text-foreground mb-4">
                    Proceeds Information
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="proceedsAmount">Amount</Label>
                        <Input
                          id="proceedsAmount"
                          type="number"
                          step="0.01"
                          value={formData.proceedsAmount}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              proceedsAmount: e.target.value,
                            })
                          }
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="proceedsCurrency">Currency</Label>
                        <Select
                          value={formData.proceedsCurrency}
                          onValueChange={(value) =>
                            setFormData({
                              ...formData,
                              proceedsCurrency: value,
                            })
                          }
                        >
                          <SelectTrigger id="proceedsCurrency">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="GBP">GBP</SelectItem>
                            <SelectItem value="CHF">CHF</SelectItem>
                            <SelectItem value="NOK">NOK</SelectItem>
                            <SelectItem value="SEK">SEK</SelectItem>
                            <SelectItem value="DKK">DKK</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="proceedsRecipient">Recipient</Label>
                        <Input
                          id="proceedsRecipient"
                          value={formData.proceedsRecipient}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              proceedsRecipient: e.target.value,
                            })
                          }
                          placeholder="e.g., General acquisitions fund"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="proceedsDate">Date Received</Label>
                        <Input
                          id="proceedsDate"
                          type="date"
                          value={formData.proceedsDate}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              proceedsDate: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="proceedsNotes">Proceeds Notes</Label>
                      <Textarea
                        id="proceedsNotes"
                        value={formData.proceedsNotes}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            proceedsNotes: e.target.value,
                          })
                        }
                        placeholder="Additional notes about the proceeds..."
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              )}

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
                    {isSubmitting ? "Updating..." : "Update Deaccession"}
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
