"use client";

import { Button } from "@v1/ui/button";
import Link from "next/link";
import type { MoveRequestDetail } from "./use-move-request-detail";

interface MoveRequestObjectLinkProps {
  request: MoveRequestDetail;
}

export function MoveRequestObjectLink({ request }: MoveRequestObjectLinkProps) {
  if (!request.collection?._id) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="text-lg font-semibold">Object</h2>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
        <div>
          <p className="font-medium">{request.collection.title}</p>
          <p className="text-sm text-muted-foreground">
            {request.collection.accessionNumber}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/objects/${request.collection._id}`}>Open object</Link>
        </Button>
      </div>
    </div>
  );
}
