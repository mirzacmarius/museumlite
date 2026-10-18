"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import type { FunctionReturnType } from "convex/server";
import { ArrowLeft, Save } from "lucide-react";
import { useI18n } from "@/locales/client";
import { ObjectDeaccessionAction } from "../object-deaccession-action";

type CollectionDoc = NonNullable<
  FunctionReturnType<typeof api.collections.get>
>;

interface CollectionEditFormHeaderProps {
  t: (key: string) => string;
  common: (key: string) => string;
  collectionId: string;
  collection: CollectionDoc;
  isSubmitting: boolean;
  canUpdateObject: boolean;
  onNavigate: (href: string) => void;
}

export function CollectionEditFormHeader({
  t,
  common,
  collectionId,
  collection,
  isSubmitting,
  canUpdateObject,
  onNavigate,
}: CollectionEditFormHeaderProps) {
  const tRoot = useI18n();
  return (
    <header className="z-20 flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border/60 bg-background/90 px-4 py-2 backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 items-center gap-2 text-xs">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={tRoot("objects.backToObject")}
          onClick={() => onNavigate(`/objects/${collectionId}`)}
        >
          <ArrowLeft
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
        </Button>
        <span className="hidden text-muted-foreground sm:inline">
          {t("detail.collections")}
        </span>
        <span className="hidden text-muted-foreground/50 sm:inline">/</span>
        <span className="truncate font-medium text-foreground">
          {tRoot("untranslatedRecords.objects.edit.editObject")}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <ObjectDeaccessionAction
          collectionId={collection._id}
          collectionTitle={collection.title}
          organizationId={collection.organizationId}
        />

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onNavigate(`/objects/${collectionId}`)}
        >
          {common("cancel")}
        </Button>
        <Button
          type="submit"
          size="sm"
          form="object-edit-form"
          disabled={isSubmitting || !canUpdateObject}
        >
          <Save className="mr-2 size-4" />
          {isSubmitting ? common("updating") : t("form.actions.updateObject")}
        </Button>
      </div>
    </header>
  );
}
