"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@v1/ui/command";
import { useQuery } from "convex/react";
import {
  Archive,
  Box,
  Building2,
  CreditCard,
  FilePlus,
  LayoutDashboard,
  Library,
  MapPin,
  Plus,
  Search,
  Settings,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import * as React from "react";
import { ADMINISTRATOR_PERMISSION } from "@/components/administration-access";
import { useCommandPalette } from "./command-palette-provider";
import { useOrganization } from "./organization-provider";
import { usePermissions } from "./permission-gate";

const CommandObjectItem = React.memo(
  ({
    obj,
    runCommand,
    imageUrl,
  }: {
    obj: {
      _id: Id<"collections">;
      title: string;
      accessionNumber: string;
    };
    runCommand: (command: () => unknown) => void;
    imageUrl: string | null | undefined;
  }) => {
    const { push } = useRouter();

    return (
      <CommandItem
        value={`${obj.title} ${obj.accessionNumber}`}
        onSelect={() => runCommand(() => push(`/objects/${obj._id}`))}
        className="flex items-center gap-2"
      >
        {imageUrl ? (
          <div className="relative size-7 overflow-hidden rounded-[4px] border border-border/50 shrink-0 bg-muted/20">
            <Image
              src={imageUrl}
              alt={obj.title}
              fill
              sizes="(max-width: 768px) 100vw, 400px"
              className="object-cover"
            />
          </div>
        ) : (
          <div className="flex size-7 items-center justify-center rounded-[4px] border border-border/50 bg-muted/20 shrink-0">
            <Box className="size-3.5 text-muted-foreground" />
          </div>
        )}
        <div className="flex flex-col overflow-hidden gap-0.5">
          <span className="truncate leading-none">{obj.title}</span>
          <span className="text-[10px] text-muted-foreground truncate font-mono leading-none opacity-70">
            {obj.accessionNumber}
          </span>
        </div>
      </CommandItem>
    );
  },
);

CommandObjectItem.displayName = "CommandObjectItem";

export function CommandPalette() {
  const { open, setOpen } = useCommandPalette();
  const [search, setSearch] = React.useState("");
  const { push } = useRouter();
  const { currentOrganizationId } = useOrganization();
  const { hasPermission } = usePermissions();
  const isAdministrator = hasPermission(ADMINISTRATOR_PERMISSION);

  const normalizedSearch = search.trim();
  const hasSearch = normalizedSearch.length > 1;

  const searchResults = useQuery(
    api.search.globalSearch,
    currentOrganizationId && hasSearch
      ? {
          organizationId: currentOrganizationId,
          query: normalizedSearch,
          limit: 5,
        }
      : "skip",
  );

  // Batch fetch all image URLs for objects in search results
  const collectionIds = React.useMemo(() => {
    if (!searchResults?.objects) return [];
    return searchResults.objects.map((obj) => obj._id);
  }, [searchResults?.objects]);

  const batchImageUrls = useQuery(
    api.media.getBatchPrimaryImageUrls,
    hasSearch && searchResults && collectionIds.length > 0
      ? { collectionIds }
      : "skip",
  );

  // Create a map for O(1) lookup of image URLs by collection ID
  const imageUrlMap = React.useMemo(() => {
    if (!batchImageUrls) return new Map<Id<"collections">, string | null>();
    return new Map(batchImageUrls.map((item) => [item.collectionId, item.url]));
  }, [batchImageUrls]);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };

    const openPalette = () => {
      setOpen(true);
    };

    document.addEventListener("keydown", down);
    window.addEventListener("command-palette:open", openPalette);
    return () => {
      document.removeEventListener("keydown", down);
      window.removeEventListener("command-palette:open", openPalette);
    };
  }, [open, setOpen]);

  const runCommand = React.useCallback(
    (command: () => unknown) => {
      setOpen(false);
      setSearch("");
      command();
    },
    [setOpen],
  );

  return (
    <>
      <Button
        type="button"
        variant="outline"
        aria-label="Open command palette"
        aria-keyshortcuts="Meta+K Ctrl+K"
        className="relative h-9 w-full justify-start rounded-[0.5rem] bg-background text-sm font-normal text-muted-foreground shadow-none sm:pr-12 md:w-40 lg:w-64"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 size-4" />
        <span className="hidden lg:inline-flex">Search objects…</span>
        <span className="inline-flex lg:hidden">Search…</span>
        <kbd className="pointer-events-none absolute right-[0.3rem] top-[0.3rem] hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={(open) => {
          setOpen(open);
          if (!open) setSearch("");
        }}
      >
        <CommandInput
          placeholder="Type a command or search…"
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          <CommandEmpty>
            No matches. Try objects or collection groups.
          </CommandEmpty>

          {hasSearch && searchResults && (
            <>
              {searchResults.objects.length > 0 && (
                <CommandGroup heading="Objects">
                  {searchResults.objects.map((obj) => (
                    <CommandObjectItem
                      key={obj._id}
                      obj={obj}
                      runCommand={runCommand}
                      imageUrl={imageUrlMap.get(obj._id)}
                    />
                  ))}
                </CommandGroup>
              )}

              {searchResults.collectionGroups.length > 0 && (
                <CommandGroup heading="Collection Groups">
                  {searchResults.collectionGroups.map((group) => (
                    <CommandItem
                      key={group._id}
                      value={group.name}
                      onSelect={() =>
                        runCommand(() => push(`/collections/${group._id}`))
                      }
                    >
                      <div className="mr-2 flex size-7 items-center justify-center rounded-[4px] border border-border/50 bg-muted/20 shrink-0">
                        <Archive className="size-3.5 text-muted-foreground" />
                      </div>
                      <span>{group.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {searchResults.loans.length > 0 && (
                <CommandGroup heading="Loans">
                  {searchResults.loans.map((loan) => (
                    <CommandItem
                      key={loan._id}
                      value={`${loan.loanNumber} ${loan.lenderBorrowerName}`}
                      onSelect={() =>
                        runCommand(() => push(`/loans/${loan._id}`))
                      }
                    >
                      <div className="mr-2 flex size-7 items-center justify-center rounded-[4px] border border-border/50 bg-muted/20 shrink-0">
                        <CreditCard className="size-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex flex-col overflow-hidden gap-0.5">
                        <span className="truncate leading-none">
                          {loan.loanNumber}
                        </span>
                        <span className="text-[10px] text-muted-foreground truncate leading-none opacity-70">
                          {loan.lenderBorrowerName}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {searchResults.accessions.length > 0 && (
                <CommandGroup heading="Accessions">
                  {searchResults.accessions.map((acc) => (
                    <CommandItem
                      key={acc._id}
                      value={acc.accessionNumber}
                      onSelect={() =>
                        runCommand(() => push(`/accessions/${acc._id}`))
                      }
                    >
                      <div className="mr-2 flex size-7 items-center justify-center rounded-[4px] border border-border/50 bg-muted/20 shrink-0">
                        <Building2 className="size-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex flex-col overflow-hidden gap-0.5">
                        <span className="truncate leading-none">
                          {acc.accessionNumber}
                        </span>
                        <span className="text-[10px] text-muted-foreground truncate leading-none opacity-70">
                          {acc.method} - {acc.status}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {searchResults.locations.length > 0 && (
                <CommandGroup heading="Locations">
                  {searchResults.locations.map((loc) => (
                    <CommandItem
                      key={loc._id}
                      value={loc.name}
                      onSelect={() =>
                        runCommand(() => push(`/locations/${loc._id}`))
                      }
                    >
                      <div className="mr-2 flex size-7 items-center justify-center rounded-[4px] border border-border/50 bg-muted/20 shrink-0">
                        <MapPin className="size-3.5 text-muted-foreground" />
                      </div>
                      <span>{loc.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              <CommandSeparator />
            </>
          )}

          <CommandGroup heading="Create">
            <CommandItem
              onSelect={() => runCommand(() => push("/objects/new"))}
            >
              <FilePlus className="mr-2 size-4" />
              <span>New Object</span>
              <CommandShortcut>⌘N</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => push("/accessions/new"))}
            >
              <Plus className="mr-2 size-4" />
              <span>New Accession</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => push("/loans/new"))}>
              <Plus className="mr-2 size-4" />
              <span>New Loan</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => push("/collections/new"))}
            >
              <Plus className="mr-2 size-4" />
              <span>New Collection Group</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Navigation">
            <CommandItem onSelect={() => runCommand(() => push("/"))}>
              <LayoutDashboard className="mr-2 size-4" />
              <span>Dashboard</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => push("/objects"))}>
              <Box className="mr-2 size-4" />
              <span>Objects</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => push("/collections"))}
            >
              <Archive className="mr-2 size-4" />
              <span>Collection Groups</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => push("/accessions"))}>
              <Building2 className="mr-2 size-4" />
              <span>Accessions</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => push("/loans"))}>
              <CreditCard className="mr-2 size-4" />
              <span>Loans</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => push("/locations"))}>
              <MapPin className="mr-2 size-4" />
              <span>Locations</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => push("/library"))}>
              <Library className="mr-2 size-4" />
              <span>Library</span>
            </CommandItem>
            {isAdministrator ? (
              <CommandItem
                onSelect={() =>
                  runCommand(() => push("/settings/organization"))
                }
              >
                <Settings className="mr-2 size-4" />
                <span>Settings</span>
              </CommandItem>
            ) : null}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
