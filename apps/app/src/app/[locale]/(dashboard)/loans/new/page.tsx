"use client";

import { Header } from "@/app/[locale]/(dashboard)/_components/header";
import { api } from "@v1/backend/convex/_generated/api";
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
import { useMutation } from "convex/react";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
  });

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
        organizationId: currentOrganizationId as any,
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
          ? parseFloat(formData.insuranceValue)
          : undefined,
        notes: formData.notes || undefined,
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
                      onValueChange={(value: any) =>
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

