"use client";

import { parseDateInputValue } from "@/lib/account-holder";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Command } from "@v1/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { useMutation, useQuery } from "convex/react";
import { Building2, ChevronsUpDown } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { AccountComboboxCreateDialog } from "./account-combobox-create-dialog";
import { AccountComboboxListContent } from "./account-combobox-list-content";
import {
  type AccountComboboxProps,
  type NewAccountForm,
  initialAccountFormState,
} from "./account-combobox-types";

export type { AccountComboboxProps } from "./account-combobox-types";

export function AccountCombobox({
  organizationId,
  value,
  onValueChange,
  onAccountSelect,
  placeholder = "Select or create account...",
  disabled = false,
}: AccountComboboxProps) {
  const tToast = useScopedI18n("common.toast");
  const [open, setOpen] = React.useState(false);
  const listId = React.useId();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [formData, setFormData] = React.useState<NewAccountForm>(
    initialAccountFormState,
  );
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

  const openCreateDialog = (prefillName: string) => {
    setOpen(false);
    setFormData({
      ...initialAccountFormState,
      businessName: prefillName,
    });
    setDialogOpen(true);
  };

  const handleCreateAccount = async () => {
    if (!organizationId || !formData.businessName.trim()) {
      toast.error(tToast("businessNameRequired"));
      return;
    }

    const isOrganization = formData.holderType === "organization";

    setIsSubmitting(true);
    try {
      const accountId = await createAccount({
        organizationId: organizationId as Id<"organizations">,
        accountType: "institution",
        holderType: formData.holderType,
        businessName: formData.businessName.trim(),
        taxId: isOrganization ? formData.taxId.trim() || undefined : undefined,
        dateOfBirth: isOrganization
          ? undefined
          : parseDateInputValue(formData.dateOfBirth),
        phone: formData.phone.trim() || undefined,
        email: formData.email.trim() || undefined,
        address: formData.address.trim() || undefined,
        address2: formData.address2.trim() || undefined,
        zipCode: formData.zipCode.trim() || undefined,
        city: formData.city.trim() || undefined,
        country: formData.country.trim() || undefined,
        contactPerson: isOrganization
          ? formData.contactPerson.trim() || undefined
          : undefined,
        contactPhone: isOrganization
          ? formData.contactPhone.trim() || undefined
          : undefined,
        contactEmail: isOrganization
          ? formData.contactEmail.trim() || undefined
          : undefined,
        notes: formData.notes.trim() || undefined,
      });

      toast.success(tToast("accountCreated"));
      setDialogOpen(false);
      setFormData(initialAccountFormState);

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
      toast.error(err instanceof Error ? err.message : tToast("createFailed"));
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
            aria-controls={listId}
            className="w-full justify-between"
            disabled={disabled}
          >
            {selectedAccount ? (
              <div className="flex items-center gap-2 truncate">
                <Building2 className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{selectedAccount.businessName}</span>
                <span className="text-xs text-muted-foreground">
                  ({selectedAccount.accountNumber})
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <AccountComboboxListContent
              listId={listId}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              organizationId={organizationId}
              accounts={accounts?.accounts}
              value={value}
              onSelect={handleSelect}
              onOpenCreateDialog={openCreateDialog}
            />
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

      <AccountComboboxCreateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        formData={formData}
        setFormData={setFormData}
        isSubmitting={isSubmitting}
        onCreate={handleCreateAccount}
      />
    </>
  );
}
