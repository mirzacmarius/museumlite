"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { PartySummary } from "@v1/backend/convex/utils/partyValidators";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@v1/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { cn } from "@v1/ui/utils";
import { useMutation, useQuery } from "convex/react";
import { Building2, Check, ChevronsUpDown, Plus, User } from "lucide-react";
import {
  type SetStateAction,
  useCallback,
  useDeferredValue,
  useId,
  useReducer,
} from "react";
import { toast } from "sonner";
import { usePermissions } from "@/components/permission-gate";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { usePartyErrorMessage } from "@/hooks/use-party-error-message";
import { parseDateInputValue } from "@/lib/account-holder";
import { useScopedI18n } from "@/locales/client";
import { AccountComboboxCreateDialog } from "./account-combobox-create-dialog";
import {
  initialAccountFormState,
  type NewAccountForm,
} from "./account-combobox-types";

export type { PartySummary };

/** Whether the current user may pick parties, and create them inline. */
export function usePartyPickerAccess() {
  const { hasModule } = useFeatureAccess();
  const { hasPermission } = usePermissions();
  const canPick = hasModule("accounts") && hasPermission("accounts.read");
  return { canPick, canCreate: canPick && hasPermission("accounts.write") };
}

export function partyContactLine(party: PartySummary) {
  return [party.contactPerson, party.email, party.phone]
    .filter(Boolean)
    .join(", ");
}

function PartyIcon({ party }: { party: Pick<PartySummary, "holderType"> }) {
  const Icon = party.holderType === "privatePerson" ? User : Building2;
  return <Icon className="size-4 shrink-0 text-muted-foreground" />;
}

interface PickerState {
  open: boolean;
  search: string;
  dialogOpen: boolean;
  formData: NewAccountForm;
  isSubmitting: boolean;
}

type PickerAction =
  | { type: "setOpen"; value: boolean }
  | { type: "setSearch"; value: string }
  | { type: "setDialogOpen"; value: boolean }
  | { type: "setFormData"; value: NewAccountForm }
  | { type: "setSubmitting"; value: boolean }
  | { type: "openCreate"; name: string }
  | { type: "closeCreate" };

const initialState: PickerState = {
  open: false,
  search: "",
  dialogOpen: false,
  formData: initialAccountFormState,
  isSubmitting: false,
};

function reducer(state: PickerState, action: PickerAction): PickerState {
  switch (action.type) {
    case "setOpen":
      return { ...state, open: action.value };
    case "setSearch":
      return { ...state, search: action.value };
    case "setDialogOpen":
      return { ...state, dialogOpen: action.value };
    case "setFormData":
      return { ...state, formData: action.value };
    case "setSubmitting":
      return { ...state, isSubmitting: action.value };
    case "openCreate":
      return {
        ...state,
        open: false,
        dialogOpen: true,
        formData: { ...initialAccountFormState, businessName: action.name },
      };
    case "closeCreate":
      return {
        ...state,
        dialogOpen: false,
        formData: initialAccountFormState,
        isSubmitting: false,
      };
  }
}

function trimmedOrUndefined(value: string) {
  return value.trim() || undefined;
}

interface PartyPickerProps {
  organizationId: Id<"organizations">;
  value: Id<"accounts"> | undefined;
  onChange: (party: PartySummary | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * Picks a shared person or institution (a Party) for a procedure. Searches
 * on the server, loads the selected party by ID, and lets staff with
 * `accounts.write` create a party inline after checking similar records.
 */
export function PartyPicker({
  organizationId,
  value,
  onChange,
  placeholder,
  disabled = false,
  id,
}: PartyPickerProps) {
  const t = useScopedI18n("parties");
  const { canCreate } = usePartyPickerAccess();
  const partyErrorMessage = usePartyErrorMessage();
  const [state, dispatch] = useReducer(reducer, initialState);
  const listId = useId();
  const search = useDeferredValue(state.search.trim());
  const draftName = useDeferredValue(state.formData.businessName.trim());
  const draftEmail = useDeferredValue(state.formData.email.trim());

  const results = useQuery(
    api.parties.search,
    state.open ? { organizationId, search: search || undefined } : "skip",
  );
  const selected = useQuery(
    api.parties.get,
    value ? { accountId: value } : "skip",
  );
  const similar = useQuery(
    api.parties.findSimilar,
    state.dialogOpen && draftName
      ? {
          organizationId,
          name: draftName,
          email: draftEmail || undefined,
        }
      : "skip",
  );
  const createParty = useMutation(api.parties.create);

  const setFormData = useCallback(
    (update: SetStateAction<NewAccountForm>) =>
      dispatch({
        type: "setFormData",
        value: typeof update === "function" ? update(state.formData) : update,
      }),
    [state.formData],
  );

  const choose = (party: PartySummary | undefined) => {
    onChange(party);
    dispatch({ type: "setOpen", value: false });
  };

  const handleCreate = async () => {
    const form = state.formData;
    const name = form.businessName.trim();
    if (!name) return;
    const isOrganization = form.holderType === "organization";
    dispatch({ type: "setSubmitting", value: true });
    try {
      const created = await createParty({
        organizationId,
        holderType: form.holderType,
        name,
        taxId: isOrganization ? trimmedOrUndefined(form.taxId) : undefined,
        dateOfBirth: isOrganization
          ? undefined
          : parseDateInputValue(form.dateOfBirth),
        phone: trimmedOrUndefined(form.phone),
        email: trimmedOrUndefined(form.email),
        address: trimmedOrUndefined(form.address),
        address2: trimmedOrUndefined(form.address2),
        zipCode: trimmedOrUndefined(form.zipCode),
        city: trimmedOrUndefined(form.city),
        country: trimmedOrUndefined(form.country),
        contactPerson: isOrganization
          ? trimmedOrUndefined(form.contactPerson)
          : undefined,
        contactPhone: isOrganization
          ? trimmedOrUndefined(form.contactPhone)
          : undefined,
        contactEmail: isOrganization
          ? trimmedOrUndefined(form.contactEmail)
          : undefined,
        notes: trimmedOrUndefined(form.notes),
      });
      toast.success(
        created.duplicateSuggestions > 0
          ? t("create.duplicateRecorded")
          : t("create.created"),
      );
      dispatch({ type: "closeCreate" });
      onChange({
        _id: created.accountId,
        accountNumber: "",
        displayName: name,
        holderType: form.holderType,
        email: trimmedOrUndefined(form.email),
        phone: trimmedOrUndefined(form.phone),
        contactPerson: isOrganization
          ? trimmedOrUndefined(form.contactPerson)
          : undefined,
        archived: false,
      });
    } catch (error) {
      toast.error(partyErrorMessage(error));
      dispatch({ type: "setSubmitting", value: false });
    }
  };

  const similarNotice =
    similar && similar.length > 0 ? (
      <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
        <p className="font-medium">{t("create.similarTitle")}</p>
        <p className="text-muted-foreground">
          {t("create.similarDescription")}
        </p>
        <ul className="space-y-2">
          {similar.map(({ party, reasons }) => (
            <li
              key={party._id}
              className="flex flex-wrap items-center justify-between gap-2"
            >
              <span className="flex items-center gap-2">
                <PartyIcon party={party} />
                <span className="font-medium">{party.displayName}</span>
                {reasons.map((reason) => (
                  <Badge key={reason} variant="outline">
                    {t(`reasons.${reason}`)}
                  </Badge>
                ))}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={party.archived}
                onClick={() => {
                  dispatch({ type: "closeCreate" });
                  onChange(party);
                }}
              >
                {t("create.useExisting")}
              </Button>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <>
      <Popover
        open={state.open}
        onOpenChange={(open) => dispatch({ type: "setOpen", value: open })}
      >
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={state.open}
            aria-controls={listId}
            className="w-full justify-between"
            disabled={disabled}
          >
            {value && selected ? (
              <span className="flex min-w-0 items-center gap-2">
                <PartyIcon party={selected} />
                <span className="truncate">{selected.displayName}</span>
                <span className="text-xs text-muted-foreground">
                  {selected.accountNumber}
                </span>
              </span>
            ) : (
              <span className="truncate text-muted-foreground">
                {placeholder ?? t("picker.placeholder")}
              </span>
            )}
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[420px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={t("picker.searchPlaceholder")}
              value={state.search}
              onValueChange={(text) =>
                dispatch({ type: "setSearch", value: text })
              }
            />
            <CommandList id={listId} className="max-h-[320px]">
              {results === undefined ? (
                <p className="p-4 text-sm text-muted-foreground" role="status">
                  {t("picker.searching")}
                </p>
              ) : (
                <CommandEmpty>
                  <p className="p-2 text-sm text-muted-foreground">
                    {t("picker.empty")}
                  </p>
                </CommandEmpty>
              )}
              {results && results.length > 0 ? (
                <CommandGroup heading={t("picker.heading")}>
                  {results.map((party) => (
                    <CommandItem
                      key={party._id}
                      value={party._id}
                      onSelect={() => choose(party)}
                      className="p-2"
                    >
                      <div className="flex w-full items-start gap-2">
                        <Check
                          className={cn(
                            "mt-0.5 size-4 shrink-0",
                            value === party._id ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <PartyIcon party={party} />
                            <span className="truncate font-medium">
                              {party.displayName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {party.accountNumber}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t(`holderTypes.${party.holderType}`)}
                            {partyContactLine(party)
                              ? ` · ${partyContactLine(party)}`
                              : ""}
                          </p>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {canCreate ? (
                <div className="border-t p-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() =>
                      dispatch({ type: "openCreate", name: state.search })
                    }
                  >
                    <Plus className="mr-2 size-4" />
                    {t("picker.create")}
                  </Button>
                </div>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-1 text-xs text-muted-foreground"
          onClick={() => onChange(undefined)}
          disabled={disabled}
        >
          {t("picker.clear")}
        </Button>
      ) : null}

      {canCreate ? (
        <AccountComboboxCreateDialog
          open={state.dialogOpen}
          onOpenChange={(open) =>
            open
              ? dispatch({ type: "setDialogOpen", value: true })
              : dispatch({ type: "closeCreate" })
          }
          formData={state.formData}
          setFormData={setFormData}
          isSubmitting={state.isSubmitting}
          onCreate={() => void handleCreate()}
          notice={similarNotice}
        />
      ) : null}
    </>
  );
}
