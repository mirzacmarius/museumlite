"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  REPRODUCTION_LOCALES,
  REPRODUCTION_PURPOSES,
  type ReproductionPurpose,
} from "@v1/backend/convex/utils/reproductionRequestValidators";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Textarea } from "@v1/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { ObjectCombobox } from "@/components/object-combobox";
import { PartyPicker, usePartyPickerAccess } from "@/components/party-picker";
import { useReproductionErrorMessage } from "@/hooks/use-reproduction-error-message";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

type RequestLocale = (typeof REPRODUCTION_LOCALES)[number];

/** Client checks mirroring `create`; the server rules still apply. */
const requestSchema = z.object({
  objectId: z.string().min(1),
  mediaId: z.string().min(1),
  requesterAccountId: z.string().min(1),
  purposeDetails: z.string().trim().min(1).max(4000),
});

interface RequestDraft {
  objectId?: string;
  mediaId?: string;
  requesterAccountId?: Id<"accounts">;
  purpose: ReproductionPurpose;
  purposeDetails: string;
  requesterLocale: RequestLocale;
}

const REPRODUCIBLE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/tiff",
];

export function NewRequestDialog({
  organizationId,
  onClose,
}: {
  organizationId: Id<"organizations">;
  onClose: () => void;
}) {
  const t = useScopedI18n("reproductionRequests");
  const locale = useCurrentLocale();
  const { push } = useRouter();
  const errorMessage = useReproductionErrorMessage();
  const { canPick } = usePartyPickerAccess();
  const create = useMutation(api.reproductionRequests.create);
  const [draft, setDraft] = useState<RequestDraft>(() => ({
    purpose: "academic_research",
    purposeDetails: "",
    requesterLocale:
      REPRODUCTION_LOCALES.find((candidate) => candidate === locale) ?? "en",
  }));
  const [saving, setSaving] = useState(false);
  const update = (change: Partial<RequestDraft>) =>
    setDraft((current) => ({ ...current, ...change }));
  const { objectId, mediaId, requesterAccountId } = draft;
  const media = useQuery(
    api.media.list,
    objectId ? { collectionId: objectId as Id<"collections"> } : "skip",
  );
  const images = (media ?? []).filter(
    (file) =>
      file.fileType === "image" &&
      file.mediaCategory !== "document" &&
      file.uploadStatus === "completed" &&
      REPRODUCIBLE_TYPES.includes(file.mimeType),
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = requestSchema.safeParse(draft);
    if (!parsed.success) {
      toast.error(t("create.missingFields"));
      return;
    }
    setSaving(true);
    try {
      const result = await create({
        organizationId,
        objectId: parsed.data.objectId as Id<"collections">,
        mediaId: parsed.data.mediaId as Id<"mediaFiles">,
        requesterAccountId: parsed.data.requesterAccountId as Id<"accounts">,
        purpose: draft.purpose,
        purposeDetails: parsed.data.purposeDetails,
        requesterLocale: draft.requesterLocale,
      });
      toast.success(t("create.created", { number: result.requestNumber }));
      push(`/reproduction-requests/${result.requestId}`);
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("create.title")}</DialogTitle>
            <DialogDescription>{t("create.description")}</DialogDescription>
          </DialogHeader>
          {canPick ? null : (
            <p className="rounded-md border border-border p-3 text-sm text-muted-foreground">
              {t("create.partiesUnavailable")}
            </p>
          )}
          <div className="space-y-2">
            <Label>{t("create.object")}</Label>
            <ObjectCombobox
              organizationId={organizationId}
              value={objectId}
              onValueChange={(value) =>
                update({ objectId: value, mediaId: undefined })
              }
              placeholder={t("create.objectPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="request-image">{t("create.image")}</Label>
            {objectId && media !== undefined && images.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("create.noImages")}
              </p>
            ) : (
              <Select
                value={mediaId ?? ""}
                onValueChange={(value) => update({ mediaId: value })}
                disabled={!objectId || media === undefined}
              >
                <SelectTrigger id="request-image">
                  <SelectValue placeholder={t("create.imagePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {images.map((image) => (
                    <SelectItem key={image._id} value={image._id}>
                      {image.caption || image.fileName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="request-requester">{t("create.requester")}</Label>
            <PartyPicker
              id="request-requester"
              organizationId={organizationId}
              value={requesterAccountId}
              onChange={(party) => update({ requesterAccountId: party?._id })}
              placeholder={t("create.requesterPlaceholder")}
              disabled={!canPick}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="request-purpose">{t("create.purpose")}</Label>
              <Select
                value={draft.purpose}
                onValueChange={(value) => {
                  const next = REPRODUCTION_PURPOSES.find(
                    (candidate) => candidate === value,
                  );
                  if (next) update({ purpose: next });
                }}
              >
                <SelectTrigger id="request-purpose">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPRODUCTION_PURPOSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`purposes.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="request-language">{t("create.language")}</Label>
              <Select
                value={draft.requesterLocale}
                onValueChange={(value) => {
                  const next = REPRODUCTION_LOCALES.find(
                    (candidate) => candidate === value,
                  );
                  if (next) update({ requesterLocale: next });
                }}
              >
                <SelectTrigger id="request-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPRODUCTION_LOCALES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`locales.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="request-details">
              {t("create.purposeDetails")}
            </Label>
            <Textarea
              id="request-details"
              rows={3}
              maxLength={4000}
              value={draft.purposeDetails}
              placeholder={t("create.purposeDetailsPlaceholder")}
              onChange={(event) =>
                update({ purposeDetails: event.target.value })
              }
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("detail.cancel")}
            </Button>
            <Button type="submit" disabled={saving || !canPick}>
              {saving ? t("create.submitting") : t("create.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
