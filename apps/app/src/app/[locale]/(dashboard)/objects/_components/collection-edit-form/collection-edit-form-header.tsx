"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import type { FunctionReturnType } from "convex/server";
import { AlertOctagon, Archive, ArrowLeft, Save } from "lucide-react";
import { PermissionGate } from "@/components/permission-gate";

import { useI18n } from "@/locales/client";

type CollectionDoc = NonNullable<
  FunctionReturnType<typeof api.collections.get>
>;

interface CollectionEditFormHeaderProps {
  t: (key: string) => string;
  common: (key: string) => string;
  collectionId: string;
  collection: CollectionDoc;
  hasActiveLoan: boolean;
  isSubmitting: boolean;
  canUpdateObject: boolean;
  onNavigate: (href: string) => void;
  onDeaccessionOpen: () => void;
}

export function CollectionEditFormHeader({
  t,
  common,
  collectionId,
  collection,
  hasActiveLoan,
  isSubmitting,
  canUpdateObject,
  onNavigate,
  onDeaccessionOpen,
}: CollectionEditFormHeaderProps) {
  const tRoot = useI18n();
  return (
    <header className="z-20 flex h-14 shrink-0 items-center justify-between border-b border-border/60 bg-background/90 px-6 backdrop-blur-xl">
      <div className="flex items-center gap-2 text-xs">
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
        <span className="text-muted-foreground">{t("detail.collections")}</span>
        <span className="text-muted-foreground/50">/</span>
        <span className="font-medium text-foreground">
          {tRoot("untranslatedRecords.objects.edit.editObject")}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <PermissionGate permission="collections.update">
          {collection.status === "active" && !hasActiveLoan ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={onDeaccessionOpen}
            >
              <Archive className="mr-2 size-4" />
              {tRoot("objects.bulkActions.deaccession")}
            </Button>
          ) : null}
          {collection.status === "active" && hasActiveLoan ? (
            <div
              className="hidden items-center text-xs text-muted-foreground lg:flex"
              title={common("cannotDeaccession")}
            >
              <AlertOctagon className="mr-2 size-4" />
              {tRoot("untranslatedRecords.objects.edit.cannotRemoveOnLoan")}
            </div>
          ) : null}
        </PermissionGate>

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
