"use client";

import { LocationSelector } from "@/components/location-selector";
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
import { ArrowLeft, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function EditPatronPage() {
  const params = useParams();
  const router = useRouter();
  const patronId = params.id as Id<"patrons">;
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

  const patron = useQuery(api.library.patrons.get, { patronId });
  const membershipTypes = useQuery(
    api.library.settings.listMembershipTypes,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const updatePatron = useMutation(api.library.patrons.update);

  // Form state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    membershipTypeId: "",
    expirationDate: "",
    borrowingLimit: "",
    holdLimit: "",
    preferredBranch: "",
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

  // Populate form when patron loads
  useEffect(() => {
    if (patron) {
      setFormData({
        firstName: patron.firstName || "",
        lastName: patron.lastName || "",
        email: patron.email || "",
        phone: patron.phone || "",
        dateOfBirth: patron.dateOfBirth
          ? (new Date(patron.dateOfBirth).toISOString().split("T")[0] || "")
          : "",
        membershipTypeId: patron.membershipTypeId ? String(patron.membershipTypeId) : "",
        expirationDate: patron.expirationDate
          ? (new Date(patron.expirationDate).toISOString().split("T")[0] || "")
          : "",
        borrowingLimit: patron.borrowingLimit?.toString() || "",
        holdLimit: patron.holdLimit?.toString() || "",
        preferredBranch: patron.preferredBranch || "",
        street: patron.address?.street || "",
        city: patron.address?.city || "",
        state: patron.address?.state || "",
        postalCode: patron.address?.postalCode || "",
        country: patron.address?.country || "",
        emailNotifications:
          patron.notificationPreferences?.email ?? true,
        smsNotifications: patron.notificationPreferences?.sms ?? false,
        dueDateReminder:
          patron.notificationPreferences?.dueDateReminder ?? true,
        holdReady: patron.notificationPreferences?.holdReady ?? true,
        notes: patron.notes || "",
      });
    }
  }, [patron]);

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

      await updatePatron({
        patronId,
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
        borrowingLimit: formData.borrowingLimit
          ? Number.parseInt(formData.borrowingLimit, 10)
          : undefined,
        holdLimit: formData.holdLimit
          ? Number.parseInt(formData.holdLimit, 10)
          : undefined,
        preferredBranch: formData.preferredBranch
          ? (formData.preferredBranch as Id<"locations">)
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
      setError(err instanceof Error ? err.message : "Failed to update patron");
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

  if (isLibraryEnabled === undefined || patron === undefined) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (patron === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Patron not found</p>
          <Button asChild className="mt-4">
            <Link href="/library/patrons">Back to Patrons</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-secondary px-6 dark:bg-black">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl flex-col gap-6 py-6">
        {/* Header - Matching design */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/library/patrons/${patronId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-medium">Edit Patron</h1>
            <p className="text-sm text-muted-foreground">
              Enter patron details below.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Main Form Card - Matching design style */}
          <div className="rounded-lg border border-border bg-card p-6 dark:bg-black">
            <div className="space-y-6">
              {/* Full Name - Combined from firstName/lastName to match design */}
              <div className="space-y-2">
                <Label htmlFor="fullName">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="fullName"
                  value={`${formData.firstName} ${formData.lastName}`.trim()}
                  onChange={(e) => {
                    const parts = e.target.value.trim().split(/\s+/);
                    const firstName = parts[0] ?? "";
                    const lastName = parts.slice(1).join(" ") ?? "";
                    setFormData((prev) => ({
                      ...prev,
                      firstName,
                      lastName,
                    }));
                  }}
                  placeholder="Enter full name"
                  required
                />
              </div>

              {/* Email Address - Matching design */}
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
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

              {/* Patron Type - Matching design (membershipTypeId) */}
              <div className="space-y-2">
                <Label htmlFor="patronType">Patron Type</Label>
                <Select
                  value={formData.membershipTypeId}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      membershipTypeId: value,
                    }))
                  }
                >
                  <SelectTrigger id="patronType">
                    <SelectValue placeholder="Select patron type" />
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
              </div>

              {/* Status - Matching design */}
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={patron.status}
                  onValueChange={(value) => {
                    // Status is handled separately via updateStatus mutation
                    // For now, display only
                  }}
                  disabled
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Status changes are managed from the patron detail page
                </p>
              </div>

              {/* Additional Fields - Keeping all database fields but in collapsible/expandable sections */}
              <div className="space-y-4 border-t border-border pt-4">
                <details className="group">
                  <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                    Additional Information
                  </summary>
                  <div className="mt-4 space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={formData.phone}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              phone: e.target.value,
                            }))
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
                </details>

                <details className="group">
                  <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                    Address
                  </summary>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="street">Street Address</Label>
                      <Input
                        id="street"
                        value={formData.street}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            street: e.target.value,
                          }))
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
                          setFormData((prev) => ({
                            ...prev,
                            city: e.target.value,
                          }))
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
                          setFormData((prev) => ({
                            ...prev,
                            state: e.target.value,
                          }))
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
                </details>

                <details className="group">
                  <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                    Membership Details
                  </summary>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="borrowingLimit">Borrowing Limit</Label>
                      <Input
                        id="borrowingLimit"
                        type="number"
                        min="0"
                        value={formData.borrowingLimit}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            borrowingLimit: e.target.value,
                          }))
                        }
                        placeholder="Max items at once"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="holdLimit">Hold Limit</Label>
                      <Input
                        id="holdLimit"
                        type="number"
                        min="0"
                        value={formData.holdLimit}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            holdLimit: e.target.value,
                          }))
                        }
                        placeholder="Max holds at once"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="preferredBranch">Preferred Branch</Label>
                      <LocationSelector
                        organizationId={currentOrganizationId}
                        value={formData.preferredBranch}
                        onValueChange={(value) =>
                          setFormData((prev) => ({
                            ...prev,
                            preferredBranch: value,
                          }))
                        }
                        placeholder="Select preferred branch"
                        allowNone={true}
                      />
                    </div>
                  </div>
                </details>

                <details className="group">
                  <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                    Notification Preferences
                  </summary>
                  <div className="mt-4 space-y-4">
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
                </details>
              </div>

              {/* Notes - Matching design */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder="Internal notes about this patron..."
                  rows={4}
                />
              </div>
            </div>
          </div>


          {/* Submit - Matching design button style */}
          <div className="flex justify-end gap-4 pt-4">
            <Button type="button" variant="outline" asChild>
              <Link href={`/library/patrons/${patronId}`}>Cancel</Link>
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
              Save Patron
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
