"use client";

import { AccountCombobox } from "@/components/account-combobox";
import { CollectionMultiSelectCombobox } from "@/components/collection-multi-select-combobox";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { api } from "@v1/backend/convex/_generated/api";
import type { Doc, Id } from "@v1/backend/convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@v1/ui/avatar";
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
import { cn } from "@v1/ui/utils";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, ArrowLeft, Box, Info, Save, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
// Component for selected collection item with condition input
function SelectedCollectionItem({
  collection,
  condition,
  onConditionChange,
  onRemove,
  hasIssue = false,
  issueMessage,
}: {
  collection: Pick<Doc<"collections">, "_id" | "accessionNumber" | "title">;
  condition: string;
  onConditionChange: (value: string) => void;
  onRemove: () => void;
  hasIssue?: boolean;
  issueMessage?: string;
}) {
  const primaryImageUrl = useQuery(api.media.getPrimaryImageUrl, {
    collectionId: collection._id,
  });

  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-2 transition-colors",
        hasIssue
          ? "border-destructive bg-destructive/5"
          : "border-border bg-secondary/20",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded bg-secondary ring-1 ring-border flex-shrink-0 overflow-hidden">
          {primaryImageUrl ? (
            <Image
              src={primaryImageUrl}
              alt={collection.title}
              width={40}
              height={40}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Box className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{collection.title}</p>
            {hasIssue && (
              <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            {collection.accessionNumber}
          </p>
          {hasIssue && issueMessage && (
            <p className="text-xs text-destructive mt-1">{issueMessage}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="p-1 hover:bg-destructive/10 hover:text-destructive rounded transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`condition-${collection._id}`} className="text-xs">
          Condition Out
        </Label>
        <Input
          id={`condition-${collection._id}`}
          value={condition}
          onChange={(e) => onConditionChange(e.target.value)}
          placeholder="e.g. Good, Stable, minor wear..."
          className={cn(
            "bg-background text-sm",
            hasIssue && "border-destructive",
          )}
        />
      </div>
    </div>
  );
}

export default function NewLoanPage() {
  const router = useRouter();
  const { currentOrganizationId } = useOrganization();
  const createLoan = useMutation(api.loans.create);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState({
    loanNumber: "",
    type: "incoming" as "incoming" | "outgoing",
    accountId: undefined as string | undefined,
    lenderBorrowerName: "",
    lenderBorrowerContact: "",
    startDate: new Date(),
    endDate: undefined as Date | undefined,
    terms: "",
    insuranceValue: "",
    notes: "",
  });

  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>(
    [],
  );
  // Store per-item conditions: { collectionId: conditionOut }
  const [itemConditions, setItemConditions] = useState<Record<string, string>>(
    {},
  );
  // Track collections that have issues (already in active loans)
  const [problematicCollectionIds, setProblematicCollectionIds] = useState<
    Set<string>
  >(new Set());

  // Fetch selected collections to display details
  const selectedCollections = useQuery(
    api.collections.list,
    currentOrganizationId && selectedCollectionIds.length > 0
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          paginationOpts: { numItems: 1000, cursor: null },
          status: "active",
        }
      : "skip",
  );

  const selectedCollectionsList = useMemo(() => {
    if (!selectedCollections?.page) return [];
    return selectedCollections.page.filter((c) =>
      selectedCollectionIds.includes(c._id),
    );
  }, [selectedCollections?.page, selectedCollectionIds]);

  // Validate that all selected collections belong to the current organization
  const validCollectionIds = useMemo(() => {
    if (!selectedCollections?.page || selectedCollectionIds.length === 0) {
      return [];
    }
    // Filter to only include collections that exist in the fetched results
    // This ensures they belong to the current organization
    return selectedCollectionIds.filter((id) =>
      selectedCollections.page.some((c) => c._id === id),
    );
  }, [selectedCollections?.page, selectedCollectionIds]);

  // Check which collections are in active loans (skip during submission to avoid false positives)
  const collectionsInActiveLoans = useQuery(
    api.loans.checkCollectionsInActiveLoans,
    currentOrganizationId && selectedCollectionIds.length > 0 && !isSubmitting
      ? {
          collectionIds: selectedCollectionIds as Id<"collections">[],
        }
      : "skip",
  );

  // Update problematic collection IDs when check results change
  useEffect(() => {
    if (collectionsInActiveLoans) {
      const problematicIds = new Set(
        collectionsInActiveLoans.map((item) => item.collectionId),
      );
      setProblematicCollectionIds(problematicIds);
    } else {
      setProblematicCollectionIds(new Set());
    }
  }, [collectionsInActiveLoans]);

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
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

    // Remove invalid collection IDs from state if any
    if (validCollectionIds.length !== selectedCollectionIds.length) {
      const invalidIds = selectedCollectionIds.filter(
        (id) => !validCollectionIds.includes(id),
      );
      setSelectedCollectionIds(validCollectionIds);
      // Remove conditions for invalid IDs
      setItemConditions((prev) => {
        const updated = { ...prev };
        invalidIds.forEach((id) => {
          delete updated[id];
        });
        return updated;
      });
      setError(
        "Some selected collections are no longer available and have been removed. Please try again.",
      );
      return;
    }

    // Check if there are problematic collections (already in active loans)
    if (problematicCollectionIds.size > 0) {
      const problematicList = Array.from(problematicCollectionIds);
      const problematicNames = selectedCollectionsList
        .filter((c) => problematicList.includes(c._id))
        .map((c) => c.title || c.accessionNumber)
        .join(", ");

      setError(
        `The following collections are already in active or pending loans and must be removed: ${problematicNames}. Please remove them before creating the loan.`,
      );
      return;
    }

    // Clear problematic state during submission to avoid showing false errors
    setProblematicCollectionIds(new Set());

    setIsSubmitting(true);
    try {
      await createLoan({
        organizationId: currentOrganizationId as Id<"organizations">,
        loanNumber: formData.loanNumber || undefined,
        type: formData.type,
        accountId: formData.accountId
          ? (formData.accountId as Id<"accounts">)
          : undefined,
        lenderBorrowerName: formData.lenderBorrowerName,
        lenderBorrowerContact: formData.lenderBorrowerContact || undefined,
        startDate: formData.startDate.getTime(),
        endDate: formData.endDate ? formData.endDate.getTime() : undefined,
        terms: formData.terms || undefined,
        insuranceValue: formData.insuranceValue
          ? Number.parseFloat(formData.insuranceValue)
          : undefined,
        notes: formData.notes || undefined,
        itemsWithConditions:
          validCollectionIds.length > 0
            ? validCollectionIds.map((id) => ({
                collectionId: id as Id<"collections">,
                conditionOut: itemConditions[id] || undefined,
              }))
            : undefined,
      });
      router.push("/loans");
    } catch (err) {
      console.error("Error creating loan:", err);
      let errorMessage = "Failed to create loan. Please try again.";

      if (err instanceof Error) {
        // Provide more user-friendly error messages
        if (err.message.includes("already in an active loan")) {
          errorMessage =
            "One or more selected collections are already in an active or pending loan. Please remove them and try again.";
        } else if (err.message.includes("does not belong to organization")) {
          errorMessage =
            "One or more selected collections don't belong to this organization. Please refresh and try again.";
        } else if (err.message.includes("is not active")) {
          errorMessage =
            "One or more selected collections are not active. Please select only active collections.";
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border/60 bg-background/80 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-2 text-xs">
          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
            <Link href="/loans">
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            </Link>
          </Button>
          <span className="text-muted-foreground">Loans</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="font-medium text-foreground">New Loan</span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Create New Loan
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Register a new incoming or outgoing loan record.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 lg:grid-cols-3 gap-8"
        >
          {/* Main Form Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* 1. Basic Information */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] text-foreground">
                  1
                </span>
                Basic Information
              </h2>

              <div className="grid gap-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Loan Type</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value: "incoming" | "outgoing") =>
                        setFormData({ ...formData, type: value })
                      }
                    >
                      <SelectTrigger id="type" className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="incoming">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-purple-500" />
                            Incoming Loan
                          </div>
                        </SelectItem>
                        <SelectItem value="outgoing">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-cyan-500" />
                            Outgoing Loan
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="loanNumber">
                      Loan Number{" "}
                      <span className="text-muted-foreground font-normal text-xs">
                        (Optional)
                      </span>
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
                      placeholder="Auto-generated"
                      className="bg-background font-mono placeholder:text-muted-foreground/50"
                    />
                  </div>
                </div>

                <div className="space-y-4 rounded-lg bg-secondary/30 border border-border/50 p-4">
                  <div>
                    <Label className="mb-2 block">
                      {formData.type === "incoming" ? "Lender" : "Borrower"}{" "}
                      Account
                    </Label>
                    <AccountCombobox
                      organizationId={currentOrganizationId}
                      value={formData.accountId}
                      onValueChange={(accountId) =>
                        setFormData({ ...formData, accountId })
                      }
                      onAccountSelect={(account) => {
                        if (account) {
                          setFormData({
                            ...formData,
                            accountId: account._id,
                            lenderBorrowerName: account.businessName ?? "",
                            lenderBorrowerContact: [
                              account.contactPerson,
                              account.email,
                              account.phone,
                            ]
                              .filter(Boolean)
                              .join(", "),
                          });
                        }
                      }}
                      placeholder={`Search ${formData.type === "incoming" ? "lender" : "borrower"}...`}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="lenderBorrowerName" className="text-xs">
                        Name / Institution{" "}
                        <span className="text-destructive">*</span>
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
                        placeholder="e.g. Museum of Modern Art"
                        required
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="lenderBorrowerContact"
                        className="text-xs"
                      >
                        Contact Details
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
                        placeholder="Email, phone, etc."
                        className="bg-background"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Schedule & Terms */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] text-foreground">
                  2
                </span>
                Schedule & Terms
              </h2>

              <div className="grid gap-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">
                      Start Date <span className="text-destructive">*</span>
                    </Label>
                    <DatePicker
                      id="startDate"
                      date={formData.startDate}
                      onSelect={(date: Date | undefined) =>
                        setFormData({
                          ...formData,
                          startDate: date || new Date(),
                        })
                      }
                      placeholder="Select date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <DatePicker
                      id="endDate"
                      date={formData.endDate}
                      onSelect={(date: Date | undefined) =>
                        setFormData({ ...formData, endDate: date })
                      }
                      placeholder="Select date"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="insuranceValue">Total Insurance Value</Label>
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
                    className="bg-background"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="terms">Terms & Conditions</Label>
                  <Textarea
                    id="terms"
                    value={formData.terms}
                    onChange={(e) =>
                      setFormData({ ...formData, terms: e.target.value })
                    }
                    placeholder="Loan duration terms, special requirements..."
                    rows={3}
                    className="bg-background resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Internal Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    placeholder="Staff notes..."
                    rows={2}
                    className="bg-background resize-none"
                  />
                </div>
              </div>
            </div>

            {/* 3. Items Selection */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] text-foreground">
                  3
                </span>
                Loan Items
              </h2>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>Select Collections</Label>
                  <CollectionMultiSelectCombobox
                    organizationId={
                      currentOrganizationId as Id<"organizations">
                    }
                    selectedIds={selectedCollectionIds}
                    onSelectionChange={(ids) => {
                      setSelectedCollectionIds(ids);
                      // Remove conditions for deselected items
                      setItemConditions((prev) => {
                        const updated = { ...prev };
                        Object.keys(updated).forEach((id) => {
                          if (!ids.includes(id)) {
                            delete updated[id];
                          }
                        });
                        return updated;
                      });
                    }}
                    placeholder="Search and select collections..."
                  />
                </div>

                {/* Selected Items List */}
                {selectedCollectionIds.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                        Selected ({selectedCollectionIds.length})
                      </Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          setSelectedCollectionIds([]);
                          setItemConditions({});
                        }}
                      >
                        Clear all
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {selectedCollectionsList.map((collection) => {
                        const hasIssue = problematicCollectionIds.has(
                          collection._id,
                        );
                        const issueInfo = collectionsInActiveLoans?.find(
                          (item) => item.collectionId === collection._id,
                        );
                        const issueMessage = issueInfo
                          ? `Already in ${issueInfo.status} loan ${issueInfo.loanNumber}`
                          : undefined;

                        return (
                          <SelectedCollectionItem
                            key={collection._id}
                            collection={collection}
                            condition={itemConditions[collection._id] || ""}
                            onConditionChange={(value) =>
                              setItemConditions((prev) => ({
                                ...prev,
                                [collection._id]: value,
                              }))
                            }
                            onRemove={() => {
                              setSelectedCollectionIds((prev) =>
                                prev.filter((id) => id !== collection._id),
                              );
                              setItemConditions((prev) => {
                                const updated = { ...prev };
                                delete updated[collection._id];
                                return updated;
                              });
                              // Remove from problematic set
                              setProblematicCollectionIds((prev) => {
                                const updated = new Set(prev);
                                updated.delete(collection._id);
                                return updated;
                              });
                            }}
                            hasIssue={hasIssue}
                            issueMessage={issueMessage}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Error & Actions */}
            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-2">
                <Info className="h-4 w-4" />
                {error}
              </div>
            )}

            <div className="flex justify-end gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                className="w-24"
              >
                Cancel
              </Button>
              <PermissionGate permission="loans.create">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-w-[140px]"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isSubmitting ? "Creating..." : "Create Loan"}
                </Button>
              </PermissionGate>
            </div>
          </div>

          {/* Sidebar Preview */}
          <div className="hidden lg:block space-y-6">
            <div className="sticky top-24">
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                  Summary
                </h3>

                <div className="space-y-4">
                  <div className="flex justify-between items-start border-b border-border/50 pb-4">
                    <span className="text-sm text-muted-foreground">Type</span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
                        formData.type === "incoming"
                          ? "bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-900/20 dark:text-purple-400"
                          : "bg-cyan-50 text-cyan-700 ring-cyan-600/20 dark:bg-cyan-900/20 dark:text-cyan-400",
                      )}
                    >
                      {formData.type === "incoming" ? "Incoming" : "Outgoing"}
                    </span>
                  </div>

                  <div className="pb-4 border-b border-border/50">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide block mb-1">
                      {formData.type === "incoming" ? "Lender" : "Borrower"}
                    </span>
                    <p className="text-sm font-medium text-foreground">
                      {formData.lenderBorrowerName || "—"}
                    </p>
                    {formData.lenderBorrowerContact && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formData.lenderBorrowerContact}
                      </p>
                    )}
                  </div>

                  <div className="pb-4 border-b border-border/50">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide block mb-1">
                      Dates
                    </span>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-foreground">
                        {formData.startDate.toLocaleDateString()}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-foreground">
                        {formData.endDate
                          ? formData.endDate.toLocaleDateString()
                          : "Indefinite"}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wide block mb-2">
                      Objects ({selectedCollectionIds.length})
                    </span>
                    {selectedCollectionsList.length > 0 ? (
                      <div className="flex -space-x-2 overflow-hidden">
                        {selectedCollectionsList.slice(0, 5).map((c) => (
                          <Avatar
                            key={c._id}
                            className="inline-block h-8 w-8 rounded-full ring-2 ring-background"
                          >
                            <AvatarFallback className="bg-secondary text-[8px]">
                              {c.accessionNumber.slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {selectedCollectionsList.length > 5 && (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary ring-2 ring-background text-[10px] font-medium text-muted-foreground">
                            +{selectedCollectionsList.length - 5}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        No objects selected
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
