"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { DatePickerInput } from "@v1/ui/date-picker";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { useState } from "react";
import { toast } from "sonner";

export function PolicyForm({
  organizationId,
  onSubmit,
}: {
  organizationId: Id<"organizations">;
  onSubmit: (payload: {
    organizationId: Id<"organizations">;
    policyNumber: string;
    carrier: string;
    policyType: "blanket" | "scheduled" | "exhibition" | "transit" | "loan";
    coverageAmount: number;
    effectiveDate: number;
    expirationDate: number;
    deductible?: number;
    premiumAmount?: number;
  }) => Promise<void>;
}) {
  const [form, setForm] = useState({
    policyNumber: "",
    carrier: "",
    policyType: "blanket" as
      | "blanket"
      | "scheduled"
      | "exhibition"
      | "transit"
      | "loan",
    coverageAmount: "",
    deductible: "",
    premiumAmount: "",
    effectiveDate: "",
    expirationDate: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !form.policyNumber ||
      !form.carrier ||
      !form.coverageAmount ||
      !form.effectiveDate ||
      !form.expirationDate
    ) {
      toast.error("Please fill all required fields.");
      return;
    }

    const effectiveDate = Date.parse(form.effectiveDate);
    const expirationDate = Date.parse(form.expirationDate);
    if (Number.isNaN(effectiveDate) || Number.isNaN(expirationDate)) {
      toast.error("Please provide valid dates.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        organizationId,
        policyNumber: form.policyNumber.trim(),
        carrier: form.carrier.trim(),
        policyType: form.policyType,
        coverageAmount: Number.parseFloat(form.coverageAmount),
        deductible: form.deductible
          ? Number.parseFloat(form.deductible)
          : undefined,
        premiumAmount: form.premiumAmount
          ? Number.parseFloat(form.premiumAmount)
          : undefined,
        effectiveDate,
        expirationDate,
      });
      setForm({
        policyNumber: "",
        carrier: "",
        policyType: "blanket",
        coverageAmount: "",
        deductible: "",
        premiumAmount: "",
        effectiveDate: "",
        expirationDate: "",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="policyNumber">Policy Number *</Label>
          <Input
            id="policyNumber"
            value={form.policyNumber}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, policyNumber: event.target.value }))
            }
            placeholder="POL-2024-001"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="carrier">Carrier *</Label>
          <Input
            id="carrier"
            value={form.carrier}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, carrier: event.target.value }))
            }
            placeholder="Chubb Insurance"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Policy Type *</Label>
          <Select
            value={form.policyType}
            onValueChange={(value) =>
              setForm((prev) => ({
                ...prev,
                policyType: value as typeof form.policyType,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="blanket">Blanket</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="exhibition">Exhibition</SelectItem>
              <SelectItem value="transit">Transit</SelectItem>
              <SelectItem value="loan">Loan</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="coverageAmount">Coverage Amount *</Label>
          <Input
            id="coverageAmount"
            type="number"
            min="0"
            value={form.coverageAmount}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                coverageAmount: event.target.value,
              }))
            }
            placeholder="500000"
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <DatePickerInput
          label="Effective Date *"
          id="effectiveDate"
          value={form.effectiveDate}
          onChange={(value) =>
            setForm((prev) => ({
              ...prev,
              effectiveDate: value,
            }))
          }
        />
        <DatePickerInput
          label="Expiration Date *"
          id="expirationDate"
          value={form.expirationDate}
          onChange={(value) =>
            setForm((prev) => ({
              ...prev,
              expirationDate: value,
            }))
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="deductible">Deductible</Label>
          <Input
            id="deductible"
            type="number"
            min="0"
            value={form.deductible}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, deductible: event.target.value }))
            }
            placeholder="500"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="premiumAmount">Premium Amount</Label>
          <Input
            id="premiumAmount"
            type="number"
            min="0"
            value={form.premiumAmount}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                premiumAmount: event.target.value,
              }))
            }
            placeholder="1500"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Policy"}
        </Button>
      </div>
    </form>
  );
}
