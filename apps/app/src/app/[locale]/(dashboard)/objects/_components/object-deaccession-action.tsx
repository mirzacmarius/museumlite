"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import { Archive, Clock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DeaccessionDialog } from "@/components/deaccession-dialog";
import { useI18n } from "@/locales/client";

interface ObjectDeaccessionActionProps {
  collectionId: Id<"collections">;
  collectionTitle: string;
  organizationId: Id<"organizations">;
}

const buttonClassName =
  "h-8 gap-1.5 px-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive";

/**
 * The Object's Deaccession action as `objectActions.get` reports it: hidden
 * without access, disabled with the reason the server would refuse, a link
 * to the open Case, or the dialog for sale, transfer and removal.
 */
export function ObjectDeaccessionAction({
  collectionId,
  collectionTitle,
  organizationId,
}: ObjectDeaccessionActionProps) {
  const tRoot = useI18n();
  const [open, setOpen] = useState(false);
  const deaccession = useQuery(api.objectActions.get, {
    collectionId,
  })?.deaccession;

  if (!deaccession || deaccession.state === "hidden") {
    return null;
  }

  if (deaccession.state === "in_progress") {
    return (
      <Button variant="ghost" size="sm" className={buttonClassName} asChild>
        <Link href={`/deaccessions/${deaccession.deaccessionId}`}>
          <Clock className="size-4" aria-hidden="true" />
          <span className="max-md:sr-only">
            {tRoot("objects.deaccessionAction.inProgress")}
          </span>
        </Link>
      </Button>
    );
  }

  if (deaccession.state === "blocked") {
    const reason = tRoot(
      deaccession.reason === "on_loan"
        ? "objects.deaccessionAction.onLoan"
        : "objects.deaccessionAction.notAccessioned",
    );
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={buttonClassName}
        disabled
        title={reason}
      >
        <Archive className="size-4" aria-hidden="true" />
        <span className="max-md:sr-only">
          {tRoot("objects.bulkActions.deaccession")}
        </span>
        <span className="text-xs max-lg:sr-only">· {reason}</span>
      </Button>
    );
  }

  const label =
    deaccession.approvalSteps > 0
      ? tRoot("objects.deaccessionAction.request")
      : tRoot("objects.bulkActions.deaccession");
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={buttonClassName}
        title={label}
        onClick={() => setOpen(true)}
      >
        <Archive className="size-4" aria-hidden="true" />
        <span className="max-md:sr-only">{label}</span>
      </Button>
      <DeaccessionDialog
        open={open}
        onOpenChange={setOpen}
        collectionId={collectionId}
        collectionTitle={collectionTitle}
        organizationId={organizationId}
      />
    </>
  );
}
