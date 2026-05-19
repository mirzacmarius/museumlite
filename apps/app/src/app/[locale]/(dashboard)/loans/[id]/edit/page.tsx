"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { DatePicker } from "@v1/ui/date-picker";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { cn } from "@v1/ui/utils";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  Banknote,
  Building2,
  Calendar,
  FileText,
  Info,
  Lock,
  Save,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function EditLoanPage() {
  const tActions = useScopedI18n("loans.actions");
  const tLoans = useScopedI18n("loans");
  const tCommon = useScopedI18n("common");
  const params = useParams();
  const router = useRouter();
  const loanId = params.id as string;
  const { currentOrganizationId } = useOrganization();
  const t = useScopedI18n("loans.placeholders");
  const updateLoan = useMutation(api.loans.update);

  const loan = useQuery(
    api.loans.get,
    loanId ? { loanId: loanId as Id<"loans"> } : "skip",
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    lenderBorrowerName: "",
    lenderBorrowerContact: "",
    startDate: new Date(),
    endDate: undefined as Date | undefined,
    terms: "",
    insuranceValue: "",
    notes: "",
  });

  useEffect(() => {
    if (loan) {
      setFormData({
        lenderBorrowerName: loan.lenderBorrowerName || "",
        lenderBorrowerContact: loan.lenderBorrowerContact || "",
        startDate: new Date(loan.startDate),
        endDate: loan.endDate ? new Date(loan.endDate) : undefined,
        terms: loan.terms || "",
        insuranceValue: loan.insuranceValue?.toString() || "",
        notes: loan.notes || "",
      });
    }
  }, [loan]);

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">
          {tActions("pleaseSelectOrgToEdit")}
        </p>
      </div>
    );
  }

  if (loan === undefined) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{tCommon("loading")}</p>
      </div>
    );
  }

  if (loan === null) {
    return (
      <div className="flex size-full bg-background">
        <p className="text-muted-foreground">
          {tLoans("emptyState.loanNotFound")}
        </p>
      </div>
    );
  }

  if (loan.status !== "pending") {
    return (
      <div className="flex size-full bg-background px-6">
        <div className="z-10 mx-auto flex size-full max-w-screen-md flex-col items-center justify-center gap-6">
          <div className="rounded-full bg-amber-100 p-3 text-amber-600 dark:bg-amber-900/30 dark:text-amber-500">
            <Lock className="size-6" />
          </div>
          <div className="text-center">
            <h1 className="text-lg font-semibold text-foreground">
              Loan Locked
            </h1>
            <p className="text-muted-foreground mt-2 max-w-sm">
              This loan is currently{" "}
              <span className="font-medium text-foreground">{loan.status}</span>{" "}
              and cannot be edited. Only pending loans can be modified.
            </p>
            <Button variant="outline" className="mt-6" asChild>
              <Link href={`/loans/${loanId}`}>Return to Loan Details</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.lenderBorrowerName.trim()) {
      setError(tActions("lenderBorrowerRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      await updateLoan({
        loanId: loanId as Id<"loans">,
        lenderBorrowerName: formData.lenderBorrowerName,
        lenderBorrowerContact: formData.lenderBorrowerContact || undefined,
        startDate: formData.startDate.getTime(),
        endDate: formData.endDate ? formData.endDate.getTime() : undefined,
        terms: formData.terms || undefined,
        insuranceValue: formData.insuranceValue
          ? Number.parseFloat(formData.insuranceValue)
          : undefined,
        notes: formData.notes || undefined,
      });
      router.push(`/loans/${loanId}`);
    } catch (err) {
      console.error("Error updating loan:", err);
      setError(
        err instanceof Error ? err.message : tActions("failedToCreateLoan"),
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border/60 bg-background/80 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-2 text-xs">
          <Button variant="ghost" size="icon" className="size-7" asChild>
            <Link href={`/loans/${loanId}`}>
              <ArrowLeft className="size-4 text-muted-foreground" />
            </Link>
          </Button>
          <span className="text-muted-foreground">Loans</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="text-muted-foreground">{loan.loanNumber}</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="font-medium text-foreground">Edit</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-8 pb-20">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Edit Loan Record
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Update details for loan{" "}
              <span className="font-mono text-xs bg-secondary px-1.5 py-0.5 rounded">
                {loan.loanNumber}
              </span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-2">
                <Info className="size-4" />
                {error}
              </div>
            )}

            {/* Core Info Card */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
                <Building2 className="size-4" />
                Core Information
              </h2>

              <div className="grid gap-6">
                {/* Read-only fields group */}
                <div className="grid grid-cols-2 gap-4 rounded-lg bg-secondary/50 p-4 border border-border/50">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Loan Number
                    </Label>
                    <div className="font-mono text-sm font-medium">
                      {loan.loanNumber}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Type
                    </Label>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
                          loan.type === "incoming"
                            ? "bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-900/20 dark:text-purple-400"
                            : "bg-cyan-50 text-cyan-700 ring-cyan-600/20 dark:bg-cyan-900/20 dark:text-cyan-400",
                        )}
                      >
                        {loan.type === "incoming"
                          ? tActions("incomingLoan")
                          : tActions("outgoingLoan")}
                      </span>
                      <Lock className="size-3 text-muted-foreground/50" />
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="lenderBorrowerName">
                      {loan.type === "incoming"
                        ? tActions("lender")
                        : tActions("borrower")}{" "}
                      Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="lenderBorrowerName"
                      value={formData.lenderBorrowerName}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          lenderBorrowerName: e.target.value,
                        }))
                      }
                      placeholder="e.g. Museum of Modern Art"
                      required
                      className="bg-background"
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
                        setFormData((prev) => ({
                          ...prev,
                          lenderBorrowerContact: e.target.value,
                        }))
                      }
                      placeholder={t("contactDetails")}
                      className="bg-background"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Schedule & Financials Card */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
                <Calendar className="size-4" />
                Schedule & Value
              </h2>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="startDate">
                    Start Date <span className="text-destructive">*</span>
                  </Label>
                  <DatePicker
                    id="startDate"
                    date={formData.startDate}
                    onSelect={(date: Date | undefined) =>
                      setFormData((prev) => ({
                        ...prev,
                        startDate: date || new Date(),
                      }))
                    }
                    placeholder={t("selectStartDate")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <DatePicker
                    id="endDate"
                    date={formData.endDate}
                    onSelect={(date: Date | undefined) =>
                      setFormData((prev) => ({ ...prev, endDate: date }))
                    }
                    placeholder={t("selectEndDate")}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="insuranceValue">Insurance Value</Label>
                  <div className="relative">
                    <Banknote className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="insuranceValue"
                      type="number"
                      step="0.01"
                      value={formData.insuranceValue}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          insuranceValue: e.target.value,
                        }))
                      }
                      placeholder="0.00"
                      className="pl-9 bg-background"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Terms & Notes Card */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
                <FileText className="size-4" />
                Details
              </h2>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="terms">Terms & Conditions</Label>
                  <Textarea
                    id="terms"
                    value={formData.terms}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        terms: e.target.value,
                      }))
                    }
                    placeholder={t("termsEdit")}
                    rows={4}
                    className="bg-background resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Internal Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    placeholder={t("notesEdit")}
                    rows={3}
                    className="bg-background resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                className="w-24"
              >
                Cancel
              </Button>
              <PermissionGate permission="loans.update">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-w-[140px]"
                >
                  <Save className="mr-2 size-4" />
                  {isSubmitting ? tActions("saving") : tActions("saveChanges")}
                </Button>
              </PermissionGate>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
