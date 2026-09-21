"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Command } from "@v1/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { useMutation, useQuery } from "convex/react";
import { Building2, ChevronsUpDown } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import {
  defaultLoanAccountTypeForHolder,
  holderScopedAccountFields,
} from "@/lib/account-holder";
import { useScopedI18n } from "@/locales/client";
import { AccountComboboxCreateDialog } from "./account-combobox-create-dialog";
import { AccountComboboxListContent } from "./account-combobox-list-content";
import {
  type AccountComboboxProps,
  initialAccountFormState,
  type NewAccountForm,
} from "./account-combobox-types";

export type { AccountComboboxProps } from "./account-combobox-types";

interface AccountComboboxState {
  open: boolean;
  searchQuery: string;
  dialogOpen: boolean;
  formData: NewAccountForm;
  isSubmitting: boolean;
}

type AccountComboboxAction =
  | { type: "setOpen"; value: boolean }
  | { type: "setSearchQuery"; value: string }
  | { type: "setDialogOpen"; value: boolean }
  | { type: "setFormData"; value: NewAccountForm }
  | { type: "setIsSubmitting"; value: boolean }
  | { type: "openCreateDialog"; prefillName: string };

const initialAccountComboboxState: AccountComboboxState = {
  open: false,
  searchQuery: "",
  dialogOpen: false,
  formData: initialAccountFormState,
  isSubmitting: false,
};

function accountComboboxReducer(
  state: AccountComboboxState,
  action: AccountComboboxAction,
): AccountComboboxState {
  switch (action.type) {
    case "setOpen":
      return { ...state, open: action.value };
    case "setSearchQuery":
      return { ...state, searchQuery: action.value };
    case "setDialogOpen":
      return { ...state, dialogOpen: action.value };
    case "setFormData":
      return { ...state, formData: action.value };
    case "setIsSubmitting":
      return { ...state, isSubmitting: action.value };
    case "openCreateDialog":
      return {
        ...state,
        open: false,
        dialogOpen: true,
        formData: {
          ...initialAccountFormState,
          businessName: action.prefillName,
        },
      };
  }
}

export function AccountCombobox({
  organizationId,
  value,
  onValueChange,
  onAccountSelect,
  placeholder = "Select or create account...",
  disabled = false,
}: AccountComboboxProps) {
  const tToast = useScopedI18n("common.toast");
  const [state, dispatch] = React.useReducer(
    accountComboboxReducer,
    initialAccountComboboxState,
  );
  const setFormData = React.useCallback(
    (value: React.SetStateAction<NewAccountForm>) => {
      dispatch({
        type: "setFormData",
        value: typeof value === "function" ? value(state.formData) : value,
      });
    },
    [state.formData],
  );
  const listId = React.useId();

  const accounts = useQuery(
    api.accounts.list,
    organizationId
      ? {
          organizationId: organizationId as Id<"organizations">,
          search: state.searchQuery || undefined,
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
    dispatch({ type: "setOpen", value: false });
  };

  const handleClear = () => {
    onValueChange?.(undefined);
    onAccountSelect?.(undefined);
  };

  const openCreateDialog = (prefillName: string) => {
    dispatch({ type: "openCreateDialog", prefillName });
  };

  const handleCreateAccount = async () => {
    if (!organizationId || !state.formData.businessName.trim()) {
      toast.error(tToast("businessNameRequired"));
      return;
    }

    dispatch({ type: "setIsSubmitting", value: true });
    try {
      const accountId = await createAccount({
        organizationId: organizationId as Id<"organizations">,
        accountType: defaultLoanAccountTypeForHolder(state.formData.holderType),
        holderType: state.formData.holderType,
        businessName: state.formData.businessName.trim(),
        ...holderScopedAccountFields(state.formData.holderType, {
          taxId: state.formData.taxId.trim(),
          dateOfBirth: state.formData.dateOfBirth,
          contactPerson: state.formData.contactPerson.trim(),
          contactPhone: state.formData.contactPhone.trim(),
          contactEmail: state.formData.contactEmail.trim(),
        }),
        phone: state.formData.phone.trim() || undefined,
        email: state.formData.email.trim() || undefined,
        address: state.formData.address.trim() || undefined,
        address2: state.formData.address2.trim() || undefined,
        zipCode: state.formData.zipCode.trim() || undefined,
        city: state.formData.city.trim() || undefined,
        country: state.formData.country.trim() || undefined,
        notes: state.formData.notes.trim() || undefined,
      });

      toast.success(tToast("accountCreated"));
      dispatch({ type: "setDialogOpen", value: false });
      dispatch({ type: "setFormData", value: initialAccountFormState });

      onValueChange?.(accountId);
      onAccountSelect?.({
        _id: accountId,
        businessName: state.formData.businessName.trim(),
        contactPerson: state.formData.contactPerson.trim() || undefined,
        email: state.formData.email.trim() || undefined,
        phone: state.formData.phone.trim() || undefined,
      });
    } catch (err) {
      console.error("Error creating account:", err);
      toast.error(err instanceof Error ? err.message : tToast("createFailed"));
    } finally {
      dispatch({ type: "setIsSubmitting", value: false });
    }
  };

  return (
    <>
      <Popover
        open={state.open}
        onOpenChange={(value) => dispatch({ type: "setOpen", value })}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={state.open}
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
              searchQuery={state.searchQuery}
              onSearchQueryChange={(value) =>
                dispatch({ type: "setSearchQuery", value })
              }
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
        open={state.dialogOpen}
        onOpenChange={(value) => dispatch({ type: "setDialogOpen", value })}
        formData={state.formData}
        setFormData={setFormData}
        isSubmitting={state.isSubmitting}
        onCreate={handleCreateAccount}
      />
    </>
  );
}
