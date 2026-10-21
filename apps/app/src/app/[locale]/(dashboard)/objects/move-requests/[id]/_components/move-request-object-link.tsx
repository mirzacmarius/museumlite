"use client";

import { Button } from "@v1/ui/button";
import Link from "next/link";
import { useI18n } from "@/locales/client";
import type { MoveRequestDetail } from "./use-move-request-detail";

interface MoveRequestObjectLinkProps {
  request: MoveRequestDetail;
  /** Whether the viewer's organization holds the object, so can open it. */
  canOpen: boolean;
}

export function MoveRequestObjectLink({
  request,
  canOpen,
}: MoveRequestObjectLinkProps) {
  const tRoot = useI18n();
  if (!request.collection?._id) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="text-lg font-semibold">
        {tRoot("deaccessions.table.object")}
      </h2>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
        <div>
          <p className="font-medium">{request.collection.title}</p>
          <p className="text-sm text-muted-foreground">
            {request.collection.accessionNumber}
          </p>
        </div>
        {canOpen && (
          <Button variant="outline" asChild>
            <Link href={`/objects/${request.collection._id}`}>
              {tRoot("untranslatedRecords.objects.move.openObject")}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
