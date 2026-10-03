"use client";

import { Button } from "@v1/ui/button";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import {
  ArrowLeft,
  CheckCircle,
  ImageIcon,
  Loader2,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { PermissionGate } from "@/components/permission-gate";
import { useI18n, useScopedI18n } from "@/locales/client";
import type { DeaccessionDetailViewProps } from "./deaccession-detail-view-props";
export function DeaccessionDetailReviewPanel({
  deaccession,
  collection,
  collectionThumbnailUrl,
  collectionStatusLabel,
  actionLabel,
  comment,
  setComment,
  isApproving,
  isRejecting,
  handleApprove,
  handleReject,
}: Pick<
  DeaccessionDetailViewProps,
  | "deaccession"
  | "collection"
  | "collectionThumbnailUrl"
  | "collectionStatusLabel"
  | "actionLabel"
  | "comment"
  | "setComment"
  | "isApproving"
  | "isRejecting"
  | "handleApprove"
  | "handleReject"
>) {
  const tRoot = useI18n();
  const t = useScopedI18n("deaccessions");

  return (
    <div className="grid gap-4 px-5 py-5 sm:px-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.95fr)]">
      <div className="grid gap-4">
        <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/65">
            {t("detail.reason")}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/92">
            {deaccession.reason}
          </p>
        </div>

        {deaccession.disposition || deaccession.notes ? (
          <div className="grid gap-3 md:grid-cols-2">
            {deaccession.disposition ? (
              <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/65">
                  {t("detail.disposition")}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/85">
                  {deaccession.disposition}
                </p>
              </div>
            ) : null}
            {deaccession.notes ? (
              <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/65">
                  {t("detail.notes")}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/85">
                  {deaccession.notes}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4">
        {collection ? (
          <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/65">
                  {tRoot(
                    "untranslatedRecords.deaccessions.detail.linkedObject",
                  )}
                </p>
                <h2 className="mt-1 text-base font-semibold">
                  {t("detail.collectionObject")}
                </h2>
              </div>
            </div>
            <Link
              href={`/collections/${collection._id}`}
              className="mt-3 flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 p-3 transition-colors hover:bg-accent/60"
            >
              <div className="relative flex size-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-background">
                {collectionThumbnailUrl ? (
                  <Image
                    src={collectionThumbnailUrl}
                    alt={collection.title}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                ) : (
                  <ImageIcon className="size-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {collection.title}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span>{collection.accessionNumber}</span>
                  <span className="size-1 rounded-full bg-muted-foreground/40" />
                  <span>{collectionStatusLabel}</span>
                </div>
              </div>
              <ArrowLeft className="size-4 flex-shrink-0 rotate-180 text-muted-foreground" />
            </Link>
          </div>
        ) : null}

        {deaccession.status === "pending" ? (
          <PermissionGate permission="collections.approve_deaccession">
            <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/65">
                {tRoot("untranslatedRecords.deaccessions.detail.approval")}
              </p>
              <h2 className="mt-1 text-base font-semibold">
                {t("detail.approvalAction")}
              </h2>
              <div className="mt-3 space-y-3">
                <div>
                  <Label htmlFor="comment">{t("detail.commentLabel")}</Label>
                  <Textarea
                    id="comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={t("detail.commentPlaceholder")}
                    rows={3}
                    disabled={isApproving || isRejecting}
                    className="mt-2 resize-none border-border/70 bg-background/70"
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                  <Button
                    onClick={handleApprove}
                    disabled={isApproving || isRejecting}
                    className="w-full"
                  >
                    {isApproving ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <CheckCircle className="mr-2 size-4" />
                    )}
                    {tRoot(
                      "untranslatedRecords.deaccessions.approval.approveAction",
                      {
                        action: actionLabel,
                      },
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleReject}
                    disabled={isApproving || isRejecting}
                    className="w-full"
                  >
                    {isRejecting ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <XCircle className="mr-2 size-4" />
                    )}
                    {t("actions.reject")}
                  </Button>
                </div>
              </div>
            </div>
          </PermissionGate>
        ) : null}
      </div>
    </div>
  );
}
