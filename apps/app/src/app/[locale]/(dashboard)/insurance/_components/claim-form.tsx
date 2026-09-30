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

export function ClaimForm({
  organizationId,
  policyOptions,
  onSubmit,
}: {
  organizationId: Id<"organizations">;
  policyOptions: Array<{ label: string; value: Id<"insurancePolicies"> }>;
  onSubmit: (payload: {
    organizationId: Id<"organizations">;
    policyId: Id<"insurancePolicies">;
    incidentDate: number;
    incidentType:
      | "damage"
      | "theft"
      | "loss"
      | "fire"
      | "water"
      | "vandalism"
      | "natural_disaster"
      | "transit"
      | "other";
    incidentDescription: string;
    claimedAmount: number;
    incidentLocation?: string;
  }) => Promise<void>;
}) {
  const [form, setForm] = useState({
    policyId: "",
    incidentDate: "",
    incidentType: "damage" as
      | "damage"
      | "theft"
      | "loss"
      | "fire"
      | "water"
      | "vandalism"
      | "natural_disaster"
      | "transit"
      | "other",
    incidentLocation: "",
    incidentDescription: "",
    claimedAmount: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !form.policyId ||
      !form.incidentDate ||
      !form.incidentDescription ||
      !form.claimedAmount
    ) {
      toast.error("Please fill all required fields.");
      return;
    }

    const incidentDate = Date.parse(form.incidentDate);
    if (Number.isNaN(incidentDate)) {
      toast.error("Please provide a valid incident date.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        organizationId,
        policyId: form.policyId as Id<"insurancePolicies">,
        incidentDate,
        incidentType: form.incidentType,
        incidentDescription: form.incidentDescription.trim(),
        claimedAmount: Number.parseFloat(form.claimedAmount),
        incidentLocation: form.incidentLocation.trim() || undefined,
      });
      setForm({
        policyId: "",
        incidentDate: "",
        incidentType: "damage",
        incidentLocation: "",
        incidentDescription: "",
        claimedAmount: "",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label>Policy *</Label>
        <Select
          value={form.policyId}
          onValueChange={(value) =>
            setForm((prev) => ({ ...prev, policyId: value }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select policy" />
          </SelectTrigger>
          <SelectContent>
            {policyOptions.length === 0 && (
              <SelectItem value="none" disabled>
                No policies found
              </SelectItem>
            )}
            {policyOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="incidentDate">Incident Date *</Label>
          <DatePickerInput
            id="incidentDate"
            value={form.incidentDate}
            onChange={(value) =>
              setForm((prev) => ({ ...prev, incidentDate: value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Incident Type *</Label>
          <Select
            value={form.incidentType}
            onValueChange={(value) =>
              setForm((prev) => ({
                ...prev,
                incidentType: value as typeof form.incidentType,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="damage">Damage</SelectItem>
              <SelectItem value="theft">Theft</SelectItem>
              <SelectItem value="loss">Loss</SelectItem>
              <SelectItem value="fire">Fire</SelectItem>
              <SelectItem value="water">Water</SelectItem>
              <SelectItem value="vandalism">Vandalism</SelectItem>
              <SelectItem value="natural_disaster">Natural disaster</SelectItem>
              <SelectItem value="transit">Transit</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="incidentLocation">Incident Location</Label>
        <Input
          id="incidentLocation"
          value={form.incidentLocation}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              incidentLocation: event.target.value,
            }))
          }
          placeholder="Gallery A, Storage, etc."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="incidentDescription">Incident Description *</Label>
        <Input
          id="incidentDescription"
          value={form.incidentDescription}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              incidentDescription: event.target.value,
            }))
          }
          placeholder="Describe the incident..."
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="claimedAmount">Claimed Amount *</Label>
        <Input
          id="claimedAmount"
          type="number"
          min="0"
          value={form.claimedAmount}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, claimedAmount: event.target.value }))
          }
          placeholder="25000"
          required
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={isSubmitting || policyOptions.length === 0}
        >
          {isSubmitting ? "Creating..." : "Create Claim"}
        </Button>
      </div>
    </form>
  );
}
