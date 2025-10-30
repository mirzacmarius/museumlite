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
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function EditDeaccessionPage() {
  const params = useParams();
  const router = useRouter();
  const deaccessionId = params.id as string;
  const { currentOrganizationId } = useOrganization();
  const updateDeaccession = useMutation(api.deaccessions.update);

  const deaccession = useQuery(
    api.deaccessions.get,
    deaccessionId ? { deaccessionId: deaccessionId as any } : "skip",
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    reason: "",
    method: "sale" as "sale" | "donation" | "destruction" | "transfer",
    disposition: "",
    notes: "",
  });

  useEffect(() => {
    if (deaccession) {
      setFormData({
        reason: deaccession.reason || "",
        method: deaccession.method,
        disposition: deaccession.disposition || "",
        notes: deaccession.notes || "",
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
      <>
        <Header
          title="Edit Deaccession"
          description="Update deaccession details"
        />
        <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
          <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
            <div className="flex w-full flex-col rounded-lg border border-border bg-card dark:bg-black">
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
      </>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.reason.trim()) {
      alert("Reason is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await updateDeaccession({
        deaccessionId: deaccessionId as any,
        reason: formData.reason,
        method: formData.method,
        disposition: formData.disposition || undefined,
        notes: formData.notes || undefined,
      });
      router.push(`/deaccessions/${deaccessionId}`);
    } catch (error) {
      console.error("Error updating deaccession:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to update deaccession. Please try again.",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Header
        title="Edit Deaccession"
        description="Update deaccession details"
      />
      <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
        <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
          <div className="flex w-full flex-col rounded-lg border border-border bg-card dark:bg-black">
            <div className="flex w-full items-center justify-between rounded-lg border-b border-border p-6">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/deaccessions/${deaccessionId}`}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Deaccession
                </Link>
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="mx-auto max-w-2xl space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Deaccession Number
                  </label>
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
                  <label className="text-sm font-medium">
                    Date Deaccessioned
                  </label>
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
    </>
  );
}

