"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@v1/ui/command";
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
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { cn } from "@v1/ui/utils";
import { useMutation, useQuery } from "convex/react";
import {
  Building2,
  Check,
  ChevronsUpDown,
  Mail,
  Phone,
  Plus,
  User,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

interface AccountComboboxProps {
  organizationId?: string;
  value?: string;
  onValueChange?: (accountId: string | undefined) => void;
  onAccountSelect?: (
    account:
      | {
          _id: string;
          businessName?: string;
          contactPerson?: string;
          email?: string;
          phone?: string;
        }
      | undefined,
  ) => void;
  placeholder?: string;
  disabled?: boolean;
}

interface NewAccountForm {
  businessName: string;
  phone: string;
  email: string;
  address: string;
  address2: string;
  zipCode: string;
  city: string;
  country: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
}

const initialFormState: NewAccountForm = {
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
};

export function AccountCombobox({
  organizationId,
  value,
  onValueChange,
  onAccountSelect,
  placeholder = "Select or create account...",
  disabled = false,
}: AccountComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [formData, setFormData] =
    React.useState<NewAccountForm>(initialFormState);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const accounts = useQuery(
    api.accounts.list,
    organizationId
      ? {
          organizationId: organizationId as Id<"organizations">,
          search: searchQuery || undefined,
        }
      : "skip",
  );

  const createAccount = useMutation(api.accounts.create);

  const selectedAccount = React.useMemo(() => {
    if (!value || !accounts?.accounts) return undefined;
    return accounts.accounts.find((a) => a._id === value);
  }, [value, accounts?.accounts]);

  const handleSelect = (accountId: string) => {
    const account = accounts?.accounts.find((a) => a._id === accountId);
    onValueChange?.(accountId);
    onAccountSelect?.(
      account
        ? {
            _id: account._id,
            businessName: account.businessName,
            contactPerson: account.contactPerson,
            email: account.email,
            phone: account.phone,
          }
        : undefined,
    );
    setOpen(false);
  };

  const handleClear = () => {
    onValueChange?.(undefined);
    onAccountSelect?.(undefined);
  };

  const handleCreateAccount = async () => {
    if (!organizationId || !formData.businessName.trim()) {
      toast.error("Business name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const accountId = await createAccount({
        organizationId: organizationId as Id<"organizations">,
        accountType: "institution",
        businessName: formData.businessName.trim(),
        phone: formData.phone.trim() || undefined,
        email: formData.email.trim() || undefined,
        address: formData.address.trim() || undefined,
        address2: formData.address2.trim() || undefined,
        zipCode: formData.zipCode.trim() || undefined,
        city: formData.city.trim() || undefined,
        country: formData.country.trim() || undefined,
        contactPerson: formData.contactPerson.trim() || undefined,
        contactPhone: formData.contactPhone.trim() || undefined,
        contactEmail: formData.contactEmail.trim() || undefined,
      });

      toast.success("Account created successfully");
      setDialogOpen(false);
      setFormData(initialFormState);

      onValueChange?.(accountId);
      onAccountSelect?.({
        _id: accountId,
        businessName: formData.businessName.trim(),
        contactPerson: formData.contactPerson.trim() || undefined,
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
      });
    } catch (err) {
      console.error("Error creating account:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to create account",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            {selectedAccount ? (
              <div className="flex items-center gap-2 truncate">
                <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{selectedAccount.businessName}</span>
                <span className="text-xs text-muted-foreground">
                  ({selectedAccount.accountNumber})
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search accounts..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList className="max-h-[300px]">
              <CommandEmpty>
                <div className="p-4 text-sm text-center">
                  <p className="text-muted-foreground mb-2">
                    No accounts found.
                  </p>
                  {organizationId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setOpen(false);
                        setFormData({
                          ...initialFormState,
                          businessName: searchQuery,
                        });
                        setDialogOpen(true);
                      }}
                      className="w-full"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create New Account
                    </Button>
                  )}
                </div>
              </CommandEmpty>

              {accounts?.accounts && accounts.accounts.length > 0 && (
                <CommandGroup heading="Accounts">
                  {accounts.accounts.map((account) => (
                    <CommandItem
                      key={account._id}
                      value={account._id}
                      onSelect={() => handleSelect(account._id)}
                      className="px-2 py-2"
                    >
                      <div className="flex w-full items-start gap-2">
                        <Check
                          className={cn(
                            "h-4 w-4 shrink-0 mt-0.5",
                            value === account._id ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="font-medium truncate">
                              {account.businessName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {account.accountNumber}
                            </span>
                          </div>
                          <div className="flex flex-col gap-0.5 mt-1 text-xs text-muted-foreground">
                            {account.contactPerson && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {account.contactPerson}
                              </span>
                            )}
                            {account.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {account.email}
                              </span>
                            )}
                            {account.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {account.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {organizationId && (
                <div className="p-2 border-t">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setOpen(false);
                      setDialogOpen(true);
                    }}
                    className="w-full justify-start"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create New Account
                  </Button>
                </div>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value && selectedAccount && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="mt-1 text-xs text-muted-foreground"
        >
          Clear selection
        </Button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Account</DialogTitle>
            <DialogDescription>
              Add a new lender/borrower account to your organization.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Business Information</h4>
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="businessName">
                    Business Name / Organisation *
                  </Label>
                  <Input
                    id="businessName"
                    value={formData.businessName}
                    onChange={(e) =>
                      setFormData({ ...formData, businessName: e.target.value })
                    }
                    placeholder="Enter business or organization name"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
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
                        setFormData({ ...formData, email: e.target.value })
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
                      setFormData({ ...formData, address: e.target.value })
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
                      setFormData({ ...formData, address2: e.target.value })
                    }
                    placeholder="Apartment, suite, unit, etc."
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="zipCode">Zip Code</Label>
                    <Input
                      id="zipCode"
                      value={formData.zipCode}
                      onChange={(e) =>
                        setFormData({ ...formData, zipCode: e.target.value })
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
                        setFormData({ ...formData, city: e.target.value })
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
                        setFormData({ ...formData, country: e.target.value })
                      }
                      placeholder="Norway"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium text-sm">Contact Person</h4>
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="contactPerson">Name</Label>
                  <Input
                    id="contactPerson"
                    value={formData.contactPerson}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        contactPerson: e.target.value,
                      })
                    }
                    placeholder="Contact person name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contactPhone">Phone</Label>
                    <Input
                      id="contactPhone"
                      value={formData.contactPhone}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contactPhone: e.target.value,
                        })
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
                        setFormData({
                          ...formData,
                          contactEmail: e.target.value,
                        })
                      }
                      placeholder="person@company.com"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setFormData(initialFormState);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateAccount}
              disabled={isSubmitting || !formData.businessName.trim()}
            >
              {isSubmitting ? "Creating..." : "Create Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
