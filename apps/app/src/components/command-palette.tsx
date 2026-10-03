"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  CommandDialog,
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
import { useRouter } from "next/navigation";
import * as React from "react";
import { useI18n } from "@/locales/client";
import { useCommandPalette } from "./command-palette-provider";
import { CommandPaletteResults } from "./command-palette-results";
import { useOrganization } from "./organization-provider";

export function CommandPalette() {
  const translate = useI18n();
  const { open, setOpen } = useCommandPalette();
  const [search, setSearch] = React.useState("");
  const { push } = useRouter();
  const { currentOrganizationId } = useOrganization();

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
        aria-label={translate(
          "untranslatedComponents.labels.openCommandPalette",
        )}
        aria-keyshortcuts="Meta+K Ctrl+K"
        className="relative h-9 w-full justify-start rounded-[0.5rem] bg-background text-sm font-normal text-muted-foreground shadow-none sm:pr-12 md:w-40 lg:w-64"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 size-4" />
        <span className="hidden lg:inline-flex">
          {translate("untranslatedComponents.labels.searchObjects")}
        </span>
        <span className="inline-flex lg:hidden">
          {translate("untranslatedComponents.labels.search")}
        </span>
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
          placeholder={translate(
            "untranslatedComponents.labels.typeACommandOrSearch",
          )}
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          {hasSearch && (
            <CommandPaletteResults
              results={searchResults}
              imageUrlMap={imageUrlMap}
              translate={translate}
              runCommand={runCommand}
              navigate={push}
            />
          )}

          <CommandGroup
            heading={translate("untranslatedComponents.labels.create")}
          >
            <CommandItem
              onSelect={() => runCommand(() => push("/objects/new"))}
            >
              <FilePlus className="mr-2 size-4" />
              <span>
                {translate("untranslatedComponents.labels.newObject")}
              </span>
              <CommandShortcut>⌘N</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => push("/accessions/new"))}
            >
              <Plus className="mr-2 size-4" />
              <span>
                {translate("untranslatedComponents.labels.newAccession")}
              </span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => push("/loans/new"))}>
              <Plus className="mr-2 size-4" />
              <span>{translate("untranslatedComponents.labels.newLoan")}</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => push("/collections/new"))}
            >
              <Plus className="mr-2 size-4" />
              <span>
                {translate("untranslatedComponents.labels.newCollectionGroup")}
              </span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup
            heading={translate("untranslatedComponents.labels.navigation")}
          >
            <CommandItem onSelect={() => runCommand(() => push("/"))}>
              <LayoutDashboard className="mr-2 size-4" />
              <span>
                {translate("untranslatedComponents.labels.dashboard")}
              </span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => push("/objects"))}>
              <Box className="mr-2 size-4" />
              <span>{translate("untranslatedComponents.labels.objects")}</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => push("/collections"))}
            >
              <Archive className="mr-2 size-4" />
              <span>
                {translate("untranslatedComponents.labels.collectionGroups")}
              </span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => push("/accessions"))}>
              <Building2 className="mr-2 size-4" />
              <span>
                {translate("untranslatedComponents.labels.accessions")}
              </span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => push("/loans"))}>
              <CreditCard className="mr-2 size-4" />
              <span>{translate("untranslatedComponents.labels.loans")}</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => push("/locations"))}>
              <MapPin className="mr-2 size-4" />
              <span>
                {translate("untranslatedComponents.labels.locations")}
              </span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => push("/library"))}>
              <Library className="mr-2 size-4" />
              <span>{translate("untranslatedComponents.labels.library")}</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => push("/settings/organization"))}
            >
              <Settings className="mr-2 size-4" />
              <span>{translate("untranslatedComponents.labels.settings")}</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
