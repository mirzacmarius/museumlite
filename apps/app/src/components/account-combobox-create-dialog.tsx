"use client";

import type { AccountHolderType } from "@/lib/account-holder";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { RadioGroup, RadioGroupItem } from "@v1/ui/radio-group";
import { Textarea } from "@v1/ui/textarea";
import { cn } from "@v1/ui/utils";
import type { Dispatch, SetStateAction } from "react";
import {
  type NewAccountForm,
  initialAccountFormState,
} from "./account-combobox-types";

interface AccountComboboxCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: NewAccountForm;
  setFormData: Dispatch<SetStateAction<NewAccountForm>>;
  isSubmitting: boolean;
  onCreate: () => void;
}

export function AccountComboboxCreateDialog({
  open,
  onOpenChange,
  formData,
  setFormData,
  isSubmitting,
  onCreate,
}: AccountComboboxCreateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Account</DialogTitle>
          <DialogDescription>
            Add a new lender/borrower account to your organization.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Account Holder</h4>
            <div className="grid gap-4">
              <div className="space-y-3">
                <Label>Holder type</Label>
                <RadioGroup
                  className="grid gap-3 sm:grid-cols-2"
                  value={formData.holderType}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      holderType: value as AccountHolderType,
                    }))
                  }
                >
                  <Label
                    htmlFor="holderType-organization"
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-md border border-border p-4",
                      formData.holderType === "organization" &&
                        "border-primary bg-primary/5",
                    )}
                  >
                    <RadioGroupItem
                      id="holderType-organization"
                      value="organization"
                      className="mt-0.5"
                    />
                    <div className="space-y-1">
                      <div className="font-medium">Business / Organization</div>
                      <p className="text-sm text-muted-foreground">
                        Use this for companies, museums, galleries, and
                        institutions.
                      </p>
                    </div>
                  </Label>
                  <Label
                    htmlFor="holderType-privatePerson"
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-md border border-border p-4",
                      formData.holderType === "privatePerson" &&
                        "border-primary bg-primary/5",
                    )}
                  >
                    <RadioGroupItem
                      id="holderType-privatePerson"
                      value="privatePerson"
                      className="mt-0.5"
                    />
                    <div className="space-y-1">
                      <div className="font-medium">Private Person</div>
                      <p className="text-sm text-muted-foreground">
                        Use this for individuals acting in their own name.
                      </p>
                    </div>
                  </Label>
                </RadioGroup>
              </div>
              <div>
                <Label htmlFor="businessName">
                  {formData.holderType === "organization"
                    ? "Business Name / Organisation *"
                    : "Full Name *"}
                </Label>
                <Input
                  id="businessName"
                  value={formData.businessName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      businessName: e.target.value,
                    }))
                  }
                  placeholder={
                    formData.holderType === "organization"
                      ? "Enter business or organization name"
                      : "Enter full name"
                  }
                />
              </div>
              {formData.holderType === "organization" ? (
                <div>
                  <Label htmlFor="taxId">Organization Number</Label>
                  <Input
                    id="taxId"
                    value={formData.taxId}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        taxId: e.target.value,
                      }))
                    }
                    placeholder="Enter organization number"
                  />
                </div>
              ) : (
                <div>
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
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                    placeholder="+47 123 45 678"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    placeholder="contact@company.com"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-sm">Address</h4>
            <div className="grid gap-4">
              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      address: e.target.value,
                    }))
                  }
                  placeholder="Street address"
                />
              </div>
              <div>
                <Label htmlFor="address2">Address 2</Label>
                <Input
                  id="address2"
                  value={formData.address2}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      address2: e.target.value,
                    }))
                  }
                  placeholder="Apartment, suite, unit, etc."
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="zipCode">Zip Code</Label>
                  <Input
                    id="zipCode"
                    value={formData.zipCode}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        zipCode: e.target.value,
                      }))
                    }
                    placeholder="0000"
                  />
                </div>
                <div>
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
                <div>
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
                    placeholder="Norway"
                  />
                </div>
              </div>
            </div>
          </div>

          {formData.holderType === "organization" && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Contact Person</h4>
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="contactPerson">Name</Label>
                  <Input
                    id="contactPerson"
                    value={formData.contactPerson}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        contactPerson: e.target.value,
                      }))
                    }
                    placeholder="Contact person name"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="contactPhone">Phone</Label>
                    <Input
                      id="contactPhone"
                      value={formData.contactPhone}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          contactPhone: e.target.value,
                        }))
                      }
                      placeholder="+47 123 45 678"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactEmail">Email</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      value={formData.contactEmail}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          contactEmail: e.target.value,
                        }))
                      }
                      placeholder="person@company.com"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Additional Information / Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="Anything else that should be stored with this account"
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setFormData(initialAccountFormState);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onCreate}
            disabled={isSubmitting || !formData.businessName.trim()}
          >
            {isSubmitting ? "Creating..." : "Create Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
