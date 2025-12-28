"use client";

import { AccountCombobox } from "@/components/account-combobox";
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
import { useMutation, useQuery } from "convex/react";
import { 
  ArrowLeft, 
  Save, 
  Search, 
  X, 
  Building2,
  Calendar,
  Box,
  ChevronRight,
  Info,
  CheckCircle2
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { cn } from "@v1/ui/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@v1/ui/avatar";

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
    conditionOut: "",
  });
  
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
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

  const selectedCollectionsList = useMemo(() => {
    if (!collections?.page) return [];
    return collections.page.filter(c => selectedCollectionIds.includes(c._id));
  }, [collections?.page, selectedCollectionIds]);

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
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Create New Loan</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Register a new incoming or outgoing loan record.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form Column */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* 1. Basic Information */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] text-foreground">1</span>
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
                    <Label htmlFor="loanNumber">Loan Number <span className="text-muted-foreground font-normal text-xs">(Optional)</span></Label>
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
                      {formData.type === "incoming" ? "Lender" : "Borrower"} Account
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
                            lenderBorrowerName: account.businessName,
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
                         Name / Institution <span className="text-destructive">*</span>
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
                      <Label htmlFor="lenderBorrowerContact" className="text-xs">
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
                 <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] text-foreground">2</span>
                Schedule & Terms
              </h2>
              
              <div className="grid gap-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date <span className="text-destructive">*</span></Label>
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
                 <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] text-foreground">3</span>
                Loan Items
              </h2>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>Search Collection</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by accession number or title..."
                      value={collectionSearchQuery}
                      onChange={(e) => setCollectionSearchQuery(e.target.value)}
                      className="pl-9 bg-background"
                    />
                  </div>
                  
                  {/* Search Results */}
                  {collectionSearchQuery && (
                    <div className="mt-2 max-h-[240px] overflow-y-auto rounded-md border border-border bg-background shadow-lg">
                       {collections === undefined ? (
                          <div className="p-4 text-center text-xs text-muted-foreground">Loading...</div>
                       ) : availableCollections.length === 0 ? (
                          <div className="p-4 text-center text-xs text-muted-foreground">No matches found</div>
                       ) : (
                          <div className="p-1">
                             {availableCollections.map(collection => {
                                const isSelected = selectedCollectionIds.includes(collection._id);
                                return (
                                  <button
                                    key={collection._id}
                                    type="button"
                                    onClick={() => {
                                        if (isSelected) {
                                            setSelectedCollectionIds(prev => prev.filter(id => id !== collection._id));
                                        } else {
                                            setSelectedCollectionIds(prev => [...prev, collection._id]);
                                        }
                                    }}
                                    className={cn(
                                        "flex w-full items-center gap-3 rounded-md p-2 text-left text-sm transition-colors",
                                        isSelected ? "bg-accent/10" : "hover:bg-accent/5"
                                    )}
                                  >
                                     <div className="h-8 w-8 rounded bg-secondary flex items-center justify-center flex-shrink-0">
                                        <Box className="h-4 w-4 text-muted-foreground" />
                                     </div>
                                     <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate text-foreground">{collection.title}</p>
                                        <p className="text-xs text-muted-foreground font-mono">{collection.accessionNumber}</p>
                                     </div>
                                     {isSelected && <CheckCircle2 className="h-4 w-4 text-accent" />}
                                  </button>
                                )
                             })}
                          </div>
                       )}
                    </div>
                  )}
                </div>

                {/* Selected Items List */}
                {selectedCollectionIds.length > 0 && (
                   <div className="space-y-3">
                      <div className="flex items-center justify-between">
                         <Label className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Selected ({selectedCollectionIds.length})</Label>
                         <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-auto p-0 text-xs text-muted-foreground hover:text-destructive"
                            onClick={() => setSelectedCollectionIds([])}
                         >
                            Clear all
                         </Button>
                      </div>
                      
                      <div className="grid gap-2">
                        {selectedCollectionsList.map(collection => (
                           <div key={collection._id} className="flex items-center gap-3 rounded-lg border border-border bg-secondary/20 p-2">
                              <Avatar className="h-8 w-8 rounded bg-secondary ring-1 ring-border">
                                <AvatarImage src={collection.thumbnailUrl || undefined} />
                                <AvatarFallback className="rounded"><Box className="h-4 w-4 text-muted-foreground" /></AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                 <p className="text-sm font-medium truncate">{collection.title}</p>
                                 <p className="text-xs text-muted-foreground font-mono">{collection.accessionNumber}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSelectedCollectionIds(prev => prev.filter(id => id !== collection._id))}
                                className="p-1 hover:bg-destructive/10 hover:text-destructive rounded transition-colors"
                              >
                                 <X className="h-4 w-4" />
                              </button>
                           </div>
                        ))}
                      </div>

                      <div className="pt-2">
                        <Label htmlFor="conditionOut">Condition Out (All Items)</Label>
                        <Input
                          id="conditionOut"
                          value={formData.conditionOut}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              conditionOut: e.target.value,
                            })
                          }
                          placeholder="e.g. Good, Stable, minor wear..."
                          className="mt-1.5 bg-background"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">Applied to all selected items initially.</p>
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
                  <Button type="submit" disabled={isSubmitting} className="min-w-[140px]">
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
                   <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Summary</h3>
                   
                   <div className="space-y-4">
                      <div className="flex justify-between items-start border-b border-border/50 pb-4">
                         <span className="text-sm text-muted-foreground">Type</span>
                         <span className={cn(
                            "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
                            formData.type === "incoming" 
                              ? "bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-900/20 dark:text-purple-400" 
                              : "bg-cyan-50 text-cyan-700 ring-cyan-600/20 dark:bg-cyan-900/20 dark:text-cyan-400"
                          )}>
                            {formData.type === "incoming" ? "Incoming" : "Outgoing"}
                         </span>
                      </div>
                      
                      <div className="pb-4 border-b border-border/50">
                         <span className="text-xs text-muted-foreground uppercase tracking-wide block mb-1">{formData.type === "incoming" ? "Lender" : "Borrower"}</span>
                         <p className="text-sm font-medium text-foreground">{formData.lenderBorrowerName || "—"}</p>
                         {formData.lenderBorrowerContact && <p className="text-xs text-muted-foreground mt-0.5">{formData.lenderBorrowerContact}</p>}
                      </div>

                      <div className="pb-4 border-b border-border/50">
                          <span className="text-xs text-muted-foreground uppercase tracking-wide block mb-1">Dates</span>
                          <div className="flex items-center gap-2 text-sm">
                             <span className="text-foreground">{formData.startDate.toLocaleDateString()}</span>
                             <span className="text-muted-foreground">→</span>
                             <span className="text-foreground">{formData.endDate ? formData.endDate.toLocaleDateString() : "Indefinite"}</span>
                          </div>
                      </div>

                      <div>
                          <span className="text-xs text-muted-foreground uppercase tracking-wide block mb-2">Objects ({selectedCollectionIds.length})</span>
                          {selectedCollectionsList.length > 0 ? (
                             <div className="flex -space-x-2 overflow-hidden">
                                {selectedCollectionsList.slice(0, 5).map((c) => (
                                   <Avatar key={c._id} className="inline-block h-8 w-8 rounded-full ring-2 ring-background">
                                      <AvatarImage src={c.thumbnailUrl || undefined} />
                                      <AvatarFallback className="bg-secondary text-[8px]">{c.accessionNumber.slice(0,2)}</AvatarFallback>
                                   </Avatar>
                                ))}
                                {selectedCollectionsList.length > 5 && (
                                   <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary ring-2 ring-background text-[10px] font-medium text-muted-foreground">
                                      +{selectedCollectionsList.length - 5}
                                   </div>
                                )}
                             </div>
                          ) : (
                             <p className="text-xs text-muted-foreground italic">No objects selected</p>
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
