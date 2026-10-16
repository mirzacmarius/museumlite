"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@v1/ui/alert-dialog";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ImageOff, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ClientRelativeTime } from "@/components/client-date";
import { usePermissions } from "@/components/permission-gate";
import { useImageDeletionErrorMessage } from "@/hooks/use-image-deletion-error-message";
import { useCurrentLocale, useI18n } from "@/locales/client";

type DeletionRequest = FunctionReturnType<
  typeof api.mediaDeletions.listPending
>["requests"][number];

function RequestCard({
  request,
  canDecide,
}: {
  request: DeletionRequest;
  canDecide: boolean;
}) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const errorMessage = useImageDeletionErrorMessage();
  const approve = useMutation(api.mediaDeletions.approve);
  const reject = useMutation(api.mediaDeletions.reject);
  const [confirmingApproval, setConfirmingApproval] = useState(false);
  const [working, setWorking] = useState<"approve" | "reject" | null>(null);

  const decide = async (decision: "approve" | "reject") => {
    setWorking(decision);
    try {
      if (decision === "approve") {
        await approve({ requestId: request._id });
        toast.success(t("imageDeletion.approvals.approved"));
      } else {
        await reject({ requestId: request._id });
        toast.success(t("imageDeletion.approvals.rejected"));
      }
      setConfirmingApproval(false);
    } catch (error) {
      toast.error(
        errorMessage(error, t("imageDeletion.approvals.decideFailed")),
      );
    } finally {
      setWorking(null);
    }
  };

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center">
      <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
        {request.imageUrl ? (
          <Image
            src={request.imageUrl}
            alt={request.fileName}
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : (
          <ImageOff
            className="size-5 text-muted-foreground"
            aria-label={t("imageDeletion.approvals.imageUnavailable")}
          />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="break-words text-sm font-medium text-foreground">
          {request.fileName}
        </p>
        {request.objectTitle ? (
          <Link
            href={`/objects/${request.collectionId}`}
            className="block break-words text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {request.accessionNumber
              ? `${request.accessionNumber} · ${request.objectTitle}`
              : request.objectTitle}
          </Link>
        ) : null}
        <p className="text-[11px] text-muted-foreground">
          {request.requestedByName
            ? `${t("imageDeletion.approvals.requestedBy", {
                name: request.requestedByName,
              })} · `
            : null}
          <ClientRelativeTime
            timestamp={request.requestedAt}
            locale={locale}
            options={{ addSuffix: true }}
          />
        </p>
      </div>
      {canDecide ? (
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={working !== null}
            onClick={() => void decide("reject")}
          >
            {working === "reject" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {t("imageDeletion.approvals.reject")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={working !== null}
            onClick={() => setConfirmingApproval(true)}
          >
            {t("imageDeletion.approvals.approve")}
          </Button>
        </div>
      ) : null}
      <AlertDialog
        open={confirmingApproval}
        onOpenChange={(open) => {
          if (working === null) setConfirmingApproval(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("imageDeletion.finalConfirm.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("imageDeletion.finalConfirm.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working !== null}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={working !== null}
              onClick={() => void decide("approve")}
            >
              {working === "approve" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {t("imageDeletion.deleteImage")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

/** Image deletions waiting for approval, with Approve and Reject for approvers. */
export function ImageDeletionRequests({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useI18n();
  const { hasPermission, isLoading } = usePermissions();
  const canRead = hasPermission("media.read");
  const pending = useQuery(
    api.mediaDeletions.listPending,
    !isLoading && canRead ? { organizationId } : "skip",
  );

  if (!isLoading && !canRead) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("imageDeletion.approvals.noAccess")}
      </p>
    );
  }
  if (pending === undefined) {
    return (
      <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
    );
  }
  return (
    <div className="space-y-3">
      {!pending.canDecide && pending.requests.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("imageDeletion.approvals.readOnly")}
        </p>
      ) : null}
      {pending.requests.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {t("imageDeletion.approvals.empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {pending.requests.map((request) => (
            <RequestCard
              key={request._id}
              request={request}
              canDecide={pending.canDecide}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
