"use client";

import { useOrganization } from "@/components/organization-provider";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Checkbox } from "@v1/ui/checkbox";
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
import { ArrowLeft, Loader2, Save, Shield, UserCog, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewAccountPage() {
  const router = useRouter();
  const { currentOrganizationId } = useOrganization();
  const createAccount = useMutation(api.accounts.create);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    businessName: "",
    phone: "",
    email: "",
    address: "",
    address2: "",
    zipCode: "",
    city: "",
    country: "",
    contactPerson: "",
    contactPhone: "",
    contactEmail: "",
    notes: "",
    accountType: "institution" as
      | "lender"
      | "borrower"
      | "both"
      | "institution",
    selectedRoles: [] as Id<"roles">[],
  });

  const roles = useQuery(
    api.roles.listRoles,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const permissions = useQuery(api.roles.listPermissions, {});

  // Get roles that have loans permissions
  const rolesWithLoansPermissions = roles?.filter((role) => {
    return role.permissions.some((perm) => perm.category === "loans");
  });

  const toggleRole = (roleId: Id<"roles">) => {
    setFormData((prev) => ({
      ...prev,
      selectedRoles: prev.selectedRoles.includes(roleId)
        ? prev.selectedRoles.filter((id) => id !== roleId)
        : [...prev.selectedRoles, roleId],
    }));
  };

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">
          Please select an organization to create accounts.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.businessName.trim()) {
      setError("Business name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await createAccount({
        organizationId: currentOrganizationId,
        businessName: formData.businessName,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        address: formData.address || undefined,
        address2: formData.address2 || undefined,
        zipCode: formData.zipCode || undefined,
        city: formData.city || undefined,
        country: formData.country || undefined,
        contactPerson: formData.contactPerson || undefined,
        contactPhone: formData.contactPhone || undefined,
        contactEmail: formData.contactEmail || undefined,
        notes: formData.notes || undefined,
        accountType: formData.accountType,
        roleIds:
          formData.selectedRoles.length > 0
            ? formData.selectedRoles
            : undefined,
      });
      router.push("/accounts");
    } catch (err) {
      console.error("Error creating account:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create account. Please try again.",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-full w-full bg-background px-6">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-md gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <div className="flex w-full items-center justify-between rounded-lg p-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/accounts">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Link>
              </Button>
              <h2 className="text-xl font-medium text-primary">New Account</h2>
            </div>
          </div>

          <div className="flex w-full px-6">
            <div className="w-full border-b border-border" />
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Business Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">
                Business Information
              </h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="businessName">
                    Business Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="businessName"
                    value={formData.businessName}
                    onChange={(e) =>
                      setFormData({ ...formData, businessName: e.target.value })
                    }
                    placeholder="e.g., Museum of Modern Art"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      placeholder="contact@example.com"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">
                Address
              </h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Street Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    placeholder="123 Main Street"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address2">Address Line 2</Label>
                  <Input
                    id="address2"
                    value={formData.address2}
                    onChange={(e) =>
                      setFormData({ ...formData, address2: e.target.value })
                    }
                    placeholder="Suite 100"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) =>
                        setFormData({ ...formData, city: e.target.value })
                      }
                      placeholder="New York"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zipCode">ZIP Code</Label>
                    <Input
                      id="zipCode"
                      value={formData.zipCode}
                      onChange={(e) =>
                        setFormData({ ...formData, zipCode: e.target.value })
                      }
                      placeholder="10001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={formData.country}
                      onChange={(e) =>
                        setFormData({ ...formData, country: e.target.value })
                      }
                      placeholder="United States"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Person */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">
                Contact Person
              </h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="contactPerson">Contact Name</Label>
                  <Input
                    id="contactPerson"
                    value={formData.contactPerson}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        contactPerson: e.target.value,
                      })
                    }
                    placeholder="John Doe"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactPhone">Contact Phone</Label>
                    <Input
                      id="contactPhone"
                      value={formData.contactPhone}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contactPhone: e.target.value,
                        })
                      }
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactEmail">Contact Email</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      value={formData.contactEmail}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contactEmail: e.target.value,
                        })
                      }
                      placeholder="john@example.com"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Additional notes about this account..."
                rows={4}
              />
            </div>

            {/* Account Type / Role */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <UserCog className="h-4 w-4" />
                Account Type & Role
              </h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="accountType">Account Type</Label>
                  <Select
                    value={formData.accountType}
                    onValueChange={(
                      value: "lender" | "borrower" | "both" | "institution",
                    ) => setFormData({ ...formData, accountType: value })}
                  >
                    <SelectTrigger id="accountType">
                      <SelectValue placeholder="Select account type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lender">Lender</SelectItem>
                      <SelectItem value="borrower">Borrower</SelectItem>
                      <SelectItem value="both">
                        Both (Lender & Borrower)
                      </SelectItem>
                      <SelectItem value="institution">Institution</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Categorize this account by its role in loan transactions
                  </p>
                </div>
              </div>
            </div>

            {/* Permissions */}
            {rolesWithLoansPermissions &&
              rolesWithLoansPermissions.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Roles with Account Access
                  </h3>
                  <div className="space-y-4 rounded-lg border border-border p-4">
                    <p className="text-sm text-muted-foreground">
                      Select which roles can manage this account. Roles with
                      loans permissions are shown below.
                    </p>
                    <div className="space-y-3">
                      {rolesWithLoansPermissions.map((role) => (
                        <div
                          key={role._id}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={`role-${role._id}`}
                            checked={formData.selectedRoles.includes(role._id)}
                            onCheckedChange={() => toggleRole(role._id)}
                          />
                          <Label
                            htmlFor={`role-${role._id}`}
                            className="text-sm font-normal cursor-pointer flex-1"
                          >
                            {role.name}
                            {role.description && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                - {role.description}
                              </span>
                            )}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" variant="outline" asChild>
                <Link href="/accounts">Cancel</Link>
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {isSubmitting ? "Creating..." : "Create Account"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
