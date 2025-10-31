"use client";

import { Header } from "@/app/[locale]/(dashboard)/_components/header";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Textarea } from "@v1/ui/textarea";
import { Label } from "@v1/ui/label";
import { DatePicker } from "@v1/ui/date-picker";
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
import { ArrowLeft, Save, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";

export default function NewLoanPage() {
  const router = useRouter();
  const { currentOrganizationId } = useOrganization();
  const createLoan = useMutation(api.loans.create);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    loanNumber: "",
    type: "incoming" as "incoming" | "outgoing",
    lenderBorrowerName: "",
    lenderBorrowerContact: "",
    startDate: new Date(),
    endDate: undefined as Date | undefined,
    terms: "",
    insuranceValue: "",
    notes: "",
    conditionOut: "",
  });
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>(
    [],
  );
  const [collectionSearchQuery, setCollectionSearchQuery] = useState("");

  const collections = useQuery(
    api.collections.list,
    currentOrganizationId
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          paginationOpts: { numItems: 100, cursor: null },
          status: "active",
          search: collectionSearchQuery || undefined,
        }
      : "skip",
  );

  const availableCollections = useMemo(() => {
    if (!collections?.page) return [];
    return collections.page;
  }, [collections]);

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">
          Please select an organization to create loans.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.lenderBorrowerName.trim()) {
      setError("Lender/Borrower name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await createLoan({
        organizationId: currentOrganizationId as Id<"organizations">,
        loanNumber: formData.loanNumber || undefined,
        type: formData.type,
        lenderBorrowerName: formData.lenderBorrowerName,
        lenderBorrowerContact:
          formData.lenderBorrowerContact || undefined,
        startDate: formData.startDate.getTime(),
        endDate: formData.endDate
          ? formData.endDate.getTime()
          : undefined,
        terms: formData.terms || undefined,
        insuranceValue: formData.insuranceValue
          ? Number.parseFloat(formData.insuranceValue)
          : undefined,
        notes: formData.notes || undefined,
        collectionIds:
          selectedCollectionIds.length > 0
            ? (selectedCollectionIds as Id<"collections">[])
            : undefined,
        conditionOut: formData.conditionOut || undefined,
      });
      router.push("/loans");
    } catch (err) {
      console.error("Error creating loan:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create loan. Please try again.",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Header title="New Loan" description="Create a new loan record" />
      <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
        <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
          <div className="flex w-full flex-col rounded-lg border border-border bg-card dark:bg-black">
            <div className="flex w-full items-center justify-between rounded-lg border-b border-border p-6">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/loans">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Loans
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
                  <Label htmlFor="loanNumber">
                    Loan Number
                  </Label>
                  <Input
                    id="loanNumber"
                    value={formData.loanNumber}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        loanNumber: e.target.value,
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
                    <Label htmlFor="type">
                      Type *
                    </Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value: "incoming" | "outgoing") =>
                        setFormData({ ...formData, type: value })
                      }
                    >
                      <SelectTrigger id="type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="incoming">Incoming</SelectItem>
                        <SelectItem value="outgoing">Outgoing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="startDate">
                      Start Date *
                    </Label>
                    <DatePicker
                      id="startDate"
                      date={formData.startDate}
                      onSelect={(date) =>
                        setFormData({
                          ...formData,
                          startDate: date || new Date(),
                        })
                      }
                      placeholder="Select start date"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lenderBorrowerName">
                    {formData.type === "incoming" ? "Lender" : "Borrower"} *
                  </Label>
                  <Input
                    id="lenderBorrowerName"
                    value={formData.lenderBorrowerName}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        lenderBorrowerName: e.target.value,
                      })
                    }
                    placeholder="Name of lender or borrower"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lenderBorrowerContact">
                    Contact Information
                  </Label>
                  <Input
                    id="lenderBorrowerContact"
                    value={formData.lenderBorrowerContact}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        lenderBorrowerContact: e.target.value,
                      })
                    }
                    placeholder="Email, phone, address"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">
                    End Date
                  </Label>
                  <DatePicker
                    id="endDate"
                    date={formData.endDate}
                    onSelect={(date) =>
                      setFormData({ ...formData, endDate: date })
                    }
                    placeholder="Select end date"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="insuranceValue">
                    Insurance Value
                  </Label>
                  <Input
                    id="insuranceValue"
                    type="number"
                    step="0.01"
                    value={formData.insuranceValue}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        insuranceValue: e.target.value,
                      })
                    }
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="terms">
                    Terms
                  </Label>
                  <Textarea
                    id="terms"
                    value={formData.terms}
                    onChange={(e) =>
                      setFormData({ ...formData, terms: e.target.value })
                    }
                    placeholder="Loan terms and conditions..."
                    rows={4}
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
                    placeholder="Additional notes about this loan..."
                    rows={4}
                  />
                </div>

                {/* Collection Selection */}
                <div className="space-y-4 rounded-lg border border-border p-4">
                  <div>
                    <Label>Loan Items (Optional)</Label>
                    <p className="text-xs text-muted-foreground">
                      Select collections to include in this loan
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search by accession number or title..."
                        value={collectionSearchQuery}
                        onChange={(e) => setCollectionSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    {collections === undefined ? (
                      <p className="text-sm text-muted-foreground">
                        Loading collections...
                      </p>
                    ) : availableCollections.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {collectionSearchQuery
                          ? "No collections found matching your search"
                          : "No active collections available"}
                      </p>
                    ) : (
                      <div className="max-h-[200px] space-y-1 overflow-y-auto rounded-md border border-border p-2">
                        {availableCollections.map((collection) => {
                          const isSelected = selectedCollectionIds.includes(
                            collection._id,
                          );
                          return (
                            <button
                              key={collection._id}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedCollectionIds(
                                    selectedCollectionIds.filter(
                                      (id) => id !== collection._id,
                                    ),
                                  );
                                } else {
                                  setSelectedCollectionIds([
                                    ...selectedCollectionIds,
                                    collection._id,
                                  ]);
                                }
                              }}
                              className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                                isSelected
                                  ? "bg-primary text-primary-foreground"
                                  : "hover:bg-accent"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="font-medium">
                                    {collection.accessionNumber}
                                  </span>
                                  <span className="ml-2 text-muted-foreground">
                                    {collection.title}
                                  </span>
                                </div>
                                {isSelected && (
                                  <X className="h-4 w-4" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {selectedCollectionIds.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          Selected ({selectedCollectionIds.length}):
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {selectedCollectionIds.map((id) => {
                            const collection = collections?.page.find(
                              (c) => c._id === id,
                            );
                            return (
                              <div
                                key={id}
                                className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-sm"
                              >
                                <span>
                                  {collection?.accessionNumber} -{" "}
                                  {collection?.title}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedCollectionIds(
                                      selectedCollectionIds.filter(
                                        (i) => i !== id,
                                      ),
                                    )
                                  }
                                  className="ml-1 hover:text-destructive"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {selectedCollectionIds.length > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="conditionOut">
                        Condition Out (Optional)
                      </Label>
                      <Input
                        id="conditionOut"
                        value={formData.conditionOut}
                        onChange={(e) =>
                          setFormData({ ...formData, conditionOut: e.target.value })
                        }
                        placeholder="Condition when leaving"
                      />
                      <p className="text-xs text-muted-foreground">
                        This condition will be applied to all selected items
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                  >
                    Cancel
                  </Button>
                  <PermissionGate permission="loans.create">
                    <Button type="submit" disabled={isSubmitting}>
                      <Save className="mr-2 h-4 w-4" />
                      {isSubmitting ? "Creating..." : "Create Loan"}
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

