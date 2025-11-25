"use client";

import { useOrganization } from "@/components/organization-provider";
import { api } from "@v1/backend/convex/_generated/api";
import type { Doc, Id } from "@v1/backend/convex/_generated/dataModel";
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
import { Switch } from "@v1/ui/switch";
import { Textarea } from "@v1/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Loader2, Save, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewPatronPage() {
  const router = useRouter();
  const { currentOrganizationId } = useOrganization();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLibraryEnabled = useQuery(
    api.integrations.isEnabled,
    currentOrganizationId
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          integrationId: "library",
        }
      : "skip",
  );

  const membershipTypes = useQuery(
    api.library.settings.listMembershipTypes,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const generatedCardNumber = useQuery(
    api.library.patrons.generateNewCardNumber,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const createPatron = useMutation(api.library.patrons.create);

  // Form state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    membershipTypeId: "",
    expirationDate: "",
    // Address
    street: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    // Notification preferences
    emailNotifications: true,
    smsNotifications: false,
    dueDateReminder: true,
    holdReady: true,
    // Notes
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganizationId) return;

    setIsSaving(true);
    setError(null);

    try {
      const address =
        formData.street || formData.city || formData.postalCode
          ? {
              street: formData.street,
              city: formData.city,
              state: formData.state || undefined,
              postalCode: formData.postalCode,
              country: formData.country || undefined,
            }
          : undefined;

      const patronId = await createPatron({
        organizationId: currentOrganizationId as Id<"organizations">,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        dateOfBirth: formData.dateOfBirth
          ? new Date(formData.dateOfBirth).getTime()
          : undefined,
        membershipTypeId: formData.membershipTypeId
          ? (formData.membershipTypeId as Id<"membershipTypes">)
          : undefined,
        expirationDate: formData.expirationDate
          ? new Date(formData.expirationDate).getTime()
          : undefined,
        address,
        notificationPreferences: {
          email: formData.emailNotifications,
          sms: formData.smsNotifications,
          dueDateReminder: formData.dueDateReminder,
          holdReady: formData.holdReady,
        },
        notes: formData.notes || undefined,
      });

      router.push(`/library/patrons/${patronId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create patron");
    } finally {
      setIsSaving(false);
    }
  };

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Please select an organization.</p>
      </div>
    );
  }

  if (isLibraryEnabled === false) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">
            Library integration is not enabled.
          </p>
          <Button asChild className="mt-4">
            <Link href="/settings/integrations">Enable Integration</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (isLibraryEnabled === undefined) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-secondary px-6 dark:bg-black">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl flex-col gap-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-6 dark:bg-black">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/library/patrons">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-medium">Register New Patron</h1>
              <p className="text-sm text-muted-foreground">
                Create a new library member account
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Card Number Preview */}
          <div className="rounded-lg border border-border bg-card dark:bg-black">
            <div className="border-b border-border p-6">
              <h2 className="text-lg font-medium">Library Card</h2>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-28 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <UserPlus className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Card Number (Auto-generated)
                  </p>
                  <p className="font-mono text-lg font-medium">
                    {generatedCardNumber || "Generating..."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div className="rounded-lg border border-border bg-card dark:bg-black">
            <div className="border-b border-border p-6">
              <h2 className="text-lg font-medium">Personal Information</h2>
            </div>
            <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      firstName: e.target.value,
                    }))
                  }
                  placeholder="Enter first name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      lastName: e.target.value,
                    }))
                  }
                  placeholder="Enter last name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="patron@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      dateOfBirth: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="rounded-lg border border-border bg-card dark:bg-black">
            <div className="border-b border-border p-6">
              <h2 className="text-lg font-medium">Address</h2>
            </div>
            <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="street">Street Address</Label>
                <Input
                  id="street"
                  value={formData.street}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, street: e.target.value }))
                  }
                  placeholder="123 Main Street"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, city: e.target.value }))
                  }
                  placeholder="City"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">State / Province</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, state: e.target.value }))
                  }
                  placeholder="State"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input
                  id="postalCode"
                  value={formData.postalCode}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      postalCode: e.target.value,
                    }))
                  }
                  placeholder="12345"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      country: e.target.value,
                    }))
                  }
                  placeholder="Country"
                />
              </div>
            </div>
          </div>

          {/* Membership */}
          <div className="rounded-lg border border-border bg-card dark:bg-black">
            <div className="border-b border-border p-6">
              <h2 className="text-lg font-medium">Membership</h2>
            </div>
            <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="membershipType">Membership Type</Label>
                <Select
                  value={formData.membershipTypeId}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      membershipTypeId: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select membership type" />
                  </SelectTrigger>
                  <SelectContent>
                    {membershipTypes?.map((type: Doc<"membershipTypes">) => (
                      <SelectItem key={type._id} value={type._id}>
                        {type.name}
                        {type.isDefault && " (Default)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.membershipTypeId && membershipTypes && (
                  <p className="text-xs text-muted-foreground">
                    {(() => {
                      const selected = membershipTypes.find(
                        (t: Doc<"membershipTypes">) =>
                          t._id === formData.membershipTypeId,
                      );
                      if (selected) {
                        return `Borrowing limit: ${selected.borrowingLimit}, Hold limit: ${selected.holdLimit}, Loan period: ${selected.loanPeriodDays} days`;
                      }
                      return null;
                    })()}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="expirationDate">Expiration Date</Label>
                <Input
                  id="expirationDate"
                  type="date"
                  value={formData.expirationDate}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      expirationDate: e.target.value,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank for no expiration
                </p>
              </div>
            </div>
          </div>

          {/* Notification Preferences */}
          <div className="rounded-lg border border-border bg-card dark:bg-black">
            <div className="border-b border-border p-6">
              <h2 className="text-lg font-medium">Notification Preferences</h2>
            </div>
            <div className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications via email
                  </p>
                </div>
                <Switch
                  checked={formData.emailNotifications}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      emailNotifications: checked,
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>SMS Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications via text message
                  </p>
                </div>
                <Switch
                  checked={formData.smsNotifications}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      smsNotifications: checked,
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Due Date Reminders</Label>
                  <p className="text-sm text-muted-foreground">
                    Get reminded before items are due
                  </p>
                </div>
                <Switch
                  checked={formData.dueDateReminder}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      dueDateReminder: checked,
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Hold Ready Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when holds are ready for pickup
                  </p>
                </div>
                <Switch
                  checked={formData.holdReady}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, holdReady: checked }))
                  }
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-lg border border-border bg-card dark:bg-black">
            <div className="border-b border-border p-6">
              <h2 className="text-lg font-medium">Notes</h2>
            </div>
            <div className="p-6">
              <Textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Internal notes about this patron..."
                rows={3}
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" asChild>
              <Link href="/library/patrons">Cancel</Link>
            </Button>
            <Button
              type="submit"
              disabled={
                isSaving ||
                !formData.firstName.trim() ||
                !formData.lastName.trim()
              }
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Register Patron
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
