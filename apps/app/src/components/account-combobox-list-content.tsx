"use client";

import { Button } from "@v1/ui/button";
import {
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@v1/ui/command";
import { cn } from "@v1/ui/utils";
import { Building2, Check, Mail, Phone, Plus, User } from "lucide-react";
interface AccountListItem {
  _id: string;
  businessName?: string;
  accountNumber?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
}

interface AccountComboboxListContentProps {
  listId: string;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  organizationId?: string;
  accounts: AccountListItem[] | undefined;
  value?: string;
  onSelect: (accountId: string) => void;
  onOpenCreateDialog: (prefillName: string) => void;
}

export function AccountComboboxListContent({
  listId,
  searchQuery,
  onSearchQueryChange,
  organizationId,
  accounts,
  value,
  onSelect,
  onOpenCreateDialog,
}: AccountComboboxListContentProps) {
  return (
    <>
      <CommandInput
        placeholder="Search accounts..."
        value={searchQuery}
        onValueChange={onSearchQueryChange}
      />
      <CommandList id={listId} className="max-h-[300px]">
        <CommandEmpty>
          <div className="p-4 text-sm text-center">
            <p className="text-muted-foreground mb-2">No accounts found.</p>
            {organizationId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenCreateDialog(searchQuery)}
                className="w-full"
              >
                <Plus className="mr-2 size-4" />
                Create New Account
              </Button>
            )}
          </div>
        </CommandEmpty>

        {accounts && accounts.length > 0 && (
          <CommandGroup heading="Accounts">
            {accounts.map((account) => (
              <CommandItem
                key={account._id}
                value={account._id}
                onSelect={() => onSelect(account._id)}
                className="p-2"
              >
                <div className="flex w-full items-start gap-2">
                  <Check
                    className={cn(
                      "size-4 shrink-0 mt-0.5",
                      value === account._id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Building2 className="size-4 shrink-0 text-muted-foreground" />
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
                          <User className="size-3" />
                          {account.contactPerson}
                        </span>
                      )}
                      {account.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="size-3" />
                          {account.email}
                        </span>
                      )}
                      {account.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="size-3" />
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
              onClick={() => onOpenCreateDialog("")}
              className="w-full justify-start"
            >
              <Plus className="mr-2 size-4" />
              Create New Account
            </Button>
          </div>
        )}
      </CommandList>
    </>
  );
}
