"use client";

import { Label } from "@v1/ui/label";
import { ArrowRightLeft } from "lucide-react";
import { ClientDateFns } from "@/components/client-date";
import {
  formatMoveRequestAccessionMode,
  MoveRequestStatusBadge,
} from "./move-request-utils";
import type { MoveRequestDetail } from "./use-move-request-detail";

interface MoveRequestDetailCardProps {
  request: MoveRequestDetail;
  locale: string;
  accessionSummary: string | null;
}

export function MoveRequestDetailCard({
  request,
  locale,
  accessionSummary,
}: MoveRequestDetailCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ArrowRightLeft className="size-4" />
            Object move request
          </div>
          <h1 className="text-2xl font-semibold">
            {request.collection?.title ?? "Unknown object"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {request.sourceAccessionNumber}
          </p>
        </div>
        <MoveRequestStatusBadge status={request.status} />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div>
            <Label className="text-muted-foreground">From</Label>
            <p className="mt-1">
              {request.sourceOrganization?.name ?? "Unknown organization"}
            </p>
          </div>
          <div>
            <Label className="text-muted-foreground">To</Label>
            <p className="mt-1">
              {request.targetOrganization?.name ?? "Unknown organization"}
            </p>
          </div>
          <div>
            <Label className="text-muted-foreground">Accession handling</Label>
            <p className="mt-1">
              {formatMoveRequestAccessionMode(request.accessionMode)}
            </p>
          </div>
          <div>
            <Label className="text-muted-foreground">
              Resulting accession number
            </Label>
            <p className="mt-1 font-mono text-sm">{accessionSummary}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-muted-foreground">Requested by</Label>
            <p className="mt-1">
              {request.requestedByUser?.name ??
                request.requestedByUser?.username ??
                "Unknown user"}
            </p>
          </div>
          <div>
            <Label className="text-muted-foreground">Requested at</Label>
            <p className="mt-1">
              <ClientDateFns
                timestamp={request.requestedAt}
                format="MMMM d, yyyy 'at' p"
                locale={locale}
              />
            </p>
          </div>
          {request.sourceReviewedAt && (
            <div>
              <Label className="text-muted-foreground">
                Source approved at
              </Label>
              <p className="mt-1">
                <ClientDateFns
                  timestamp={request.sourceReviewedAt}
                  format="MMMM d, yyyy 'at' p"
                  locale={locale}
                />
              </p>
            </div>
          )}
          {request.targetReviewedAt && (
            <div>
              <Label className="text-muted-foreground">
                Target reviewed at
              </Label>
              <p className="mt-1">
                <ClientDateFns
                  timestamp={request.targetReviewedAt}
                  format="MMMM d, yyyy 'at' p"
                  locale={locale}
                />
              </p>
            </div>
          )}
          {request.executedAt && (
            <div>
              <Label className="text-muted-foreground">Executed at</Label>
              <p className="mt-1">
                <ClientDateFns
                  timestamp={request.executedAt}
                  format="MMMM d, yyyy 'at' p"
                  locale={locale}
                />
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <Label className="text-muted-foreground">Reason for move</Label>
          <p className="mt-1 whitespace-pre-wrap">{request.reason}</p>
        </div>

        {request.notes && (
          <div>
            <Label className="text-muted-foreground">Additional notes</Label>
            <p className="mt-1 whitespace-pre-wrap">{request.notes}</p>
          </div>
        )}

        {(request.sourceReviewNotes || request.targetReviewNotes) && (
          <div>
            <Label className="text-muted-foreground">Review notes</Label>
            <p className="mt-1 whitespace-pre-wrap">
              {request.targetReviewNotes ?? request.sourceReviewNotes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
