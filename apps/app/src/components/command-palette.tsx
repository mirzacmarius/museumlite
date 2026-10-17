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
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useCapabilities } from "@/hooks/use-capabilities";
import { useI18n } from "@/locales/client";
import {
  buildCommandPaletteActions,
  type CommandPaletteAction,
} from "./command-palette-actions";
import { useCommandPalette } from "./command-palette-provider";
import { CommandPaletteResults } from "./command-palette-results";
import { useOrganization } from "./organization-provider";
import { usePermissions } from "./permission-gate";

export function CommandPalette() {
  const translate = useI18n();
  const { open, setOpen } = useCommandPalette();
  const [search, setSearch] = React.useState("");
  const { push } = useRouter();
  const { currentOrganizationId, currentOrganization } = useOrganization();
  const { stateOf } = useCapabilities();
  const { hasPermission } = usePermissions();
  const paletteActions = buildCommandPaletteActions({
    capabilityState: stateOf,
    hasPermission,
    isLocationTrackingEnabled:
      currentOrganization?.settings?.locationTrackingEnabled ?? true,
  });

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
        // The spoken name starts with the visible text so voice control can target it.
        aria-label={translate("untranslatedComponents.labels.searchObjects")}
        aria-keyshortcuts="Meta+K Ctrl+K"
        // On a phone the trigger is an icon, so notifications stay on screen.
        className="relative size-9 justify-center rounded-[0.5rem] bg-background px-0 text-sm font-normal text-muted-foreground shadow-none sm:w-full sm:justify-start sm:px-3 sm:pr-12 md:w-40 lg:w-64"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4 sm:mr-2" />
        <span className="hidden lg:inline-flex">
          {translate("untranslatedComponents.labels.searchObjects")}
        </span>
        <span className="hidden sm:inline-flex lg:hidden">
          {translate("untranslatedComponents.labels.search")}
        </span>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-[0.3rem] top-[0.3rem] hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex"
        >
          <span className="text-xs">⌘</span>K
        </span>
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
            {paletteActions.create.map((action) => (
              <PaletteActionItem
                key={action.href}
                action={action}
                label={translate(
                  `untranslatedComponents.labels.${action.labelKey}`,
                )}
                onRun={() => runCommand(() => push(action.href))}
              />
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup
            heading={translate("untranslatedComponents.labels.navigation")}
          >
            {paletteActions.navigation.map((action) => (
              <PaletteActionItem
                key={action.href}
                action={action}
                label={translate(
                  `untranslatedComponents.labels.${action.labelKey}`,
                )}
                onRun={() => runCommand(() => push(action.href))}
              />
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

function PaletteActionItem({
  action,
  label,
  onRun,
}: {
  action: CommandPaletteAction;
  label: string;
  onRun: () => void;
}) {
  const Icon = action.icon;
  return (
    <CommandItem onSelect={onRun}>
      <Icon className="mr-2 size-4" />
      <span>{label}</span>
      {action.shortcut ? (
        <CommandShortcut>{action.shortcut}</CommandShortcut>
      ) : null}
    </CommandItem>
  );
}
