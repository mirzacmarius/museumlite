"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@v1/ui/command";
import type { FunctionReturnType } from "convex/server";
import { Archive, Building2, CreditCard, MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { CommandObjectItem } from "./command-palette-object-item";

type GlobalSearchResults = NonNullable<
  FunctionReturnType<typeof api.search.globalSearch>
>;

type Translate = (key: string) => string;

interface CommandPaletteResultsProps {
  results: GlobalSearchResults | undefined;
  imageUrlMap: Map<Id<"collections">, string | null>;
  translate: Translate;
  runCommand: (command: () => unknown) => void;
  navigate: (path: string) => void;
}

export function CommandPaletteResults({
  results,
  imageUrlMap,
  translate,
  runCommand,
  navigate,
}: CommandPaletteResultsProps) {
  if (!results) {
    return (
      <CommandEmpty>
        {translate(
          "untranslatedComponents.labels.noMatchesTryObjectsOrCollectionGroups",
        )}
      </CommandEmpty>
    );
  }

  return (
    <>
      {results.objects.length > 0 && (
        <CommandGroup
          heading={translate("untranslatedComponents.labels.objects")}
        >
          {results.objects.map((obj) => (
            <CommandObjectItem
              key={obj._id}
              obj={obj}
              runCommand={runCommand}
              imageUrl={imageUrlMap.get(obj._id)}
            />
          ))}
        </CommandGroup>
      )}
      {results.collectionGroups.length > 0 && (
        <CommandGroup
          heading={translate("untranslatedComponents.labels.collectionGroups")}
        >
          {results.collectionGroups.map((group) => (
            <CommandItem
              key={group._id}
              value={group.name}
              onSelect={() =>
                runCommand(() => navigate(`/collections/${group._id}`))
              }
            >
              <ResultIcon
                icon={<Archive className="size-3.5 text-muted-foreground" />}
              />
              <span>{group.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {results.loans.length > 0 && (
        <CommandGroup
          heading={translate("untranslatedComponents.labels.loans")}
        >
          {results.loans.map((loan) => (
            <CommandItem
              key={loan._id}
              value={`${loan.loanNumber} ${loan.lenderBorrowerName}`}
              onSelect={() => runCommand(() => navigate(`/loans/${loan._id}`))}
            >
              <ResultIcon
                icon={<CreditCard className="size-3.5 text-muted-foreground" />}
              />
              <div className="flex flex-col overflow-hidden gap-0.5">
                <span className="truncate leading-none">{loan.loanNumber}</span>
                <span className="text-[10px] text-muted-foreground truncate leading-none opacity-70">
                  {loan.lenderBorrowerName}
                </span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {results.accessions.length > 0 && (
        <CommandGroup
          heading={translate("untranslatedComponents.labels.accessions")}
        >
          {results.accessions.map((accession) => (
            <CommandItem
              key={accession._id}
              value={accession.accessionNumber}
              onSelect={() =>
                runCommand(() => navigate(`/accessions/${accession._id}`))
              }
            >
              <ResultIcon
                icon={<Building2 className="size-3.5 text-muted-foreground" />}
              />
              <div className="flex flex-col overflow-hidden gap-0.5">
                <span className="truncate leading-none">
                  {accession.accessionNumber}
                </span>
                <span className="text-[10px] text-muted-foreground truncate leading-none opacity-70">
                  {accession.method} - {accession.status}
                </span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {results.locations.length > 0 && (
        <CommandGroup
          heading={translate("untranslatedComponents.labels.locations")}
        >
          {results.locations.map((location) => (
            <CommandItem
              key={location._id}
              value={location.name}
              onSelect={() =>
                runCommand(() => navigate(`/locations/${location._id}`))
              }
            >
              <ResultIcon
                icon={<MapPin className="size-3.5 text-muted-foreground" />}
              />
              <span>{location.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {results.identifierIndexIncomplete && (
        <p className="px-3 py-2 text-xs text-muted-foreground">
          {translate("untranslatedComponents.labels.identifierIndexIncomplete")}
        </p>
      )}
      <CommandSeparator />
    </>
  );
}

function ResultIcon({ icon }: { icon: ReactNode }) {
  return (
    <div className="mr-2 flex size-7 items-center justify-center rounded-[4px] border border-border/50 bg-muted/20 shrink-0">
      {icon}
    </div>
  );
}
