"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import { Archive } from "lucide-react";
import { useState } from "react";
import { DeaccessionDialog } from "@/components/deaccession-dialog";
import { useI18n } from "@/locales/client";
import type { ObjectDetailData } from "../types";

interface ObjectDeaccessionActionProps {
  collection: NonNullable<ObjectDetailData["collection"]>;
  collectionId: Id<"collections">;
}

/**
 * Opens the same deaccession dialog as the edit form, so sale, transfer to
 * another organization and archiving start from the object page too.
 */
export function ObjectDeaccessionAction({
  collection,
  collectionId,
}: ObjectDeaccessionActionProps) {
  const tRoot = useI18n();
  const [open, setOpen] = useState(false);
  const isActive = collection.status === "active";
  const loans = useQuery(
    api.loans.getLoansForCollection,
    isActive ? { collectionId } : "skip",
  );
  const hasActiveLoan =
    loans?.some((loan) => loan.status === "active") ?? false;

  if (!isActive || loans === undefined || hasActiveLoan) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Archive className="mr-2 size-3.5" />
        {tRoot("objects.bulkActions.deaccession")}
      </Button>
      <DeaccessionDialog
        open={open}
        onOpenChange={setOpen}
        collectionId={collectionId}
        collectionTitle={collection.title}
        organizationId={collection.organizationId}
      />
    </>
  );
}
