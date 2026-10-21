"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import { Archive, Clock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DeaccessionDialog } from "@/components/deaccession-dialog";
import { BLOCKED_REASON_KEYS } from "@/components/deaccession-dialog-types";
import { useI18n } from "@/locales/client";

interface ObjectDeaccessionActionProps {
  collectionId: Id<"collections">;
  collectionTitle: string;
  organizationId: Id<"organizations">;
}

const buttonClassName =
  "h-8 gap-1.5 px-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive";

/**
 * The Object's Remove or transfer button, from its Deaccession action as
 * `objectActions.get` reports it: hidden without access to Deaccession or
 * Remove object, disabled with the reason the server would refuse, a link to
 * the open Case, or the dialog for sale, transfer and removal.
 */
export function ObjectDeaccessionAction({
  collectionId,
  collectionTitle,
  organizationId,
}: ObjectDeaccessionActionProps) {
  const tRoot = useI18n();
  const [open, setOpen] = useState(false);
  const actions = useQuery(api.objectActions.get, { collectionId });
  if (!actions) {
    return null;
  }
  // Without Deaccession the dialog still offers Remove object and Move. A
  // transfer in progress stops both; whatever else stops Remove object leaves
  // the Move to the server to decide.
  const deaccession =
    actions.deaccession.state === "hidden" && actions.remove.state !== "hidden"
      ? actions.remove.state === "blocked" &&
        actions.remove.reason === "in_transfer"
        ? actions.remove
        : { state: "available" as const, approvalSteps: 0 }
      : actions.deaccession;
  if (deaccession.state === "hidden") {
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
    const reason = tRoot(BLOCKED_REASON_KEYS[deaccession.reason]);
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
          {tRoot("objects.deaccessionAction.removeOrTransfer")}
        </span>
        <span className="text-xs">{reason}</span>
      </Button>
    );
  }

  const label =
    deaccession.approvalSteps > 0
      ? tRoot("objects.deaccessionAction.request")
      : tRoot("objects.deaccessionAction.removeOrTransfer");
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
