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
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { cn } from "@v1/ui/utils";
import { useQuery } from "convex/react";
import { Check, ChevronsUpDown, CircleCheck, CircleX } from "lucide-react";
import * as React from "react";

interface TransferDestination {
  _id: Id<"organizations">;
  name: string;
  accountNumber?: string;
  source?: "membership" | "public";
}

interface TransferDestinationPickerProps {
  collectionId: Id<"collections">;
  value: Id<"organizations"> | "";
  onValueChange: (organizationId: Id<"organizations">) => void;
  disabled?: boolean;
}

const ORG_ACCOUNT_PATTERN = /^ORG-\d{5}$/i;

function formatDestinationLabel(destination: TransferDestination) {
  if (destination.accountNumber) {
    return `${destination.name} (${destination.accountNumber})`;
  }
  return destination.name;
}

export function TransferDestinationPicker({
  collectionId,
  value,
  onValueChange,
  disabled = false,
}: TransferDestinationPickerProps) {
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [accountNumberInput, setAccountNumberInput] = React.useState("");
  const listId = React.useId();

  const membershipTargets = useQuery(
    api.objectMoves.listEligibleTargetOrganizations,
    { collectionId },
  );

  const trimmedSearch = searchQuery.trim();
  const searchResults = useQuery(
    api.objectMoves.searchTransferDestinations,
    trimmedSearch.length >= 2 ? { collectionId, query: trimmedSearch } : "skip",
  );

  const normalizedAccountNumber = accountNumberInput.trim().toUpperCase();
  const shouldLookupAccount =
    normalizedAccountNumber.length > 0 &&
    ORG_ACCOUNT_PATTERN.test(normalizedAccountNumber);

  const accountLookup = useQuery(
    api.objectMoves.lookupTransferDestinationByAccountNumber,
    shouldLookupAccount
      ? { collectionId, accountNumber: normalizedAccountNumber }
      : "skip",
  );

  const displayDestinations = React.useMemo(() => {
    if (trimmedSearch.length >= 2) {
      return searchResults ?? [];
    }
    return membershipTargets ?? [];
  }, [membershipTargets, searchResults, trimmedSearch.length]);

  const selectedFromList = React.useMemo(() => {
    if (!value) return null;
    return (
      displayDestinations.find((org) => org._id === value) ??
      (accountLookup?.status === "valid" &&
      accountLookup.organization._id === value
        ? accountLookup.organization
        : null)
    );
  }, [accountLookup, displayDestinations, value]);

  const selectedLabel = selectedFromList
    ? formatDestinationLabel(selectedFromList)
    : null;

  function handleSelectDestination(destination: TransferDestination) {
    onValueChange(destination._id);
    setSearchOpen(false);
    setSearchQuery("");
    if (destination.accountNumber) {
      setAccountNumberInput(destination.accountNumber);
    }
  }

  React.useEffect(() => {
    if (
      accountLookup?.status === "valid" &&
      value !== accountLookup.organization._id
    ) {
      onValueChange(accountLookup.organization._id);
    }
  }, [accountLookup, onValueChange, value]);

  const accountFeedback = (() => {
    if (!normalizedAccountNumber) return null;
    if (!ORG_ACCOUNT_PATTERN.test(normalizedAccountNumber)) {
      return {
        tone: "invalid" as const,
        message: "Enter a valid organization account number (ORG-00000).",
      };
    }
    if (accountLookup === undefined) {
      return { tone: "pending" as const, message: "Checking account number…" };
    }
    if (accountLookup.status === "valid") {
      return {
        tone: "valid" as const,
        message: `${accountLookup.organization.name} (${accountLookup.organization.accountNumber ?? normalizedAccountNumber})`,
      };
    }
    return { tone: "invalid" as const, message: accountLookup.message };
  })();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="destination-search">Search by organization or account number</Label>
        <Popover open={searchOpen} onOpenChange={setSearchOpen}>
          <PopoverTrigger asChild>
            <Button
              id="destination-search"
              variant="outline"
              role="combobox"
              aria-expanded={searchOpen}
              aria-controls={listId}
              className="w-full justify-between font-normal"
              disabled={disabled}
            >
              {selectedLabel ? (
                <span className="truncate">{selectedLabel}</span>
              ) : (
                <span className="text-muted-foreground">
                  Search destination organization
                </span>
              )}
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Type organization name or ORG-00000…"
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <CommandList id={listId}>
                <CommandEmpty>
                  {trimmedSearch.length < 2
                    ? "Type at least 2 characters to search public destinations."
                    : membershipTargets === undefined || searchResults === undefined
                      ? "Searching…"
                      : "No matching organizations found."}
                </CommandEmpty>
                <CommandGroup>
                  {displayDestinations.map((destination) => (
                    <CommandItem
                      key={destination._id}
                      value={destination._id}
                      onSelect={() => handleSelectDestination(destination)}
                    >
                      <Check
                        className={cn(
                          "mr-2 size-4",
                          value === destination._id ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <div className="flex flex-col">
                        <span>{destination.name}</span>
                        {destination.accountNumber ? (
                          <span className="text-xs text-muted-foreground">
                            {destination.accountNumber}
                            {destination.source === "public"
                              ? " · accepts transfers"
                              : null}
                          </span>
                        ) : null}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {membershipTargets !== undefined &&
        membershipTargets.length === 0 &&
        trimmedSearch.length < 2 ? (
          <p className="text-sm text-muted-foreground">
            No organizations in your account match internal transfer rules. Search
            by name or enter an organization account number below.
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="destination-account-number">
          Or enter destination account number
        </Label>
        <Input
          id="destination-account-number"
          value={accountNumberInput}
          onChange={(event) => {
            setAccountNumberInput(event.target.value.toUpperCase());
            if (!event.target.value.trim()) {
              return;
            }
          }}
          placeholder="ORG-00000"
          disabled={disabled}
          className={cn(
            accountFeedback?.tone === "valid" &&
              "border-green-600 focus-visible:ring-green-600/30",
            accountFeedback?.tone === "invalid" &&
              "border-destructive focus-visible:ring-destructive/30",
          )}
        />
        {accountFeedback ? (
          <div
            className={cn(
              "flex items-start gap-2 text-sm",
              accountFeedback.tone === "valid" && "text-green-600 dark:text-green-400",
              accountFeedback.tone === "invalid" && "text-destructive",
              accountFeedback.tone === "pending" && "text-muted-foreground",
            )}
          >
            {accountFeedback.tone === "valid" ? (
              <CircleCheck className="mt-0.5 size-4 shrink-0" />
            ) : null}
            {accountFeedback.tone === "invalid" ? (
              <CircleX className="mt-0.5 size-4 shrink-0" />
            ) : null}
            <span>{accountFeedback.message}</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Organizations that allow incoming transfers appear in search results when
            enabled in their Preferences.
          </p>
        )}
      </div>
    </div>
  );
}
