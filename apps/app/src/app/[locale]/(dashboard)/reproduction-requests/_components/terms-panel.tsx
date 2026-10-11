"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { usePermissions } from "@/components/permission-gate";
import { useReproductionErrorMessage } from "@/hooks/use-reproduction-error-message";
import { useScopedI18n } from "@/locales/client";
import { useRequestDate } from "./request-status";

function PublishTermsDialog({
  organizationId,
  onClose,
}: {
  organizationId: Id<"organizations">;
  onClose: () => void;
}) {
  const t = useScopedI18n("reproductionRequests");
  const errorMessage = useReproductionErrorMessage();
  const publish = useMutation(api.reproductionRequests.publishTerms);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast.error(t("errors.termsTextRequired"));
      return;
    }
    setSaving(true);
    try {
      const { version } = await publish({ organizationId, title, body });
      toast.success(t("terms.published", { version }));
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("terms.publishTitle")}</DialogTitle>
            <DialogDescription>
              {t("terms.publishDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="terms-title">{t("terms.termsTitle")}</Label>
            <Input
              id="terms-title"
              value={title}
              maxLength={200}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="terms-body">{t("terms.body")}</Label>
            <Textarea
              id="terms-body"
              rows={10}
              value={body}
              maxLength={4000}
              onChange={(event) => setBody(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("detail.cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {t("terms.publish")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Published versions of the Terms of use, newest first. */
export function TermsPanel({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("reproductionRequests");
  const tList = useScopedI18n("listState");
  const { hasPermission } = usePermissions();
  const formatDate = useRequestDate();
  const versions = useQuery(api.reproductionRequests.listTerms, {
    organizationId,
  });
  const [publishing, setPublishing] = useState(false);

  return (
    <section className="space-y-4" aria-labelledby="terms-title-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 id="terms-title-heading" className="text-lg font-medium">
            {t("terms.title")}
          </h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {t("terms.description")}
          </p>
        </div>
        {hasPermission("organization.manage_settings") ? (
          <Button
            variant="outline"
            className="shrink-0"
            onClick={() => setPublishing(true)}
          >
            {t("terms.publish")}
          </Button>
        ) : null}
      </div>
      {versions === undefined ? (
        <p className="text-sm text-muted-foreground" role="status">
          {tList("loading")}
        </p>
      ) : versions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          {t("terms.empty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {versions.map((version, index) => (
            <li
              key={version._id}
              className="space-y-2 rounded-lg border border-border bg-card p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{version.title}</span>
                <Badge variant="outline">
                  {t("terms.version", { version: version.version })}
                </Badge>
                {index === 0 ? (
                  <Badge variant="secondary">{t("terms.current")}</Badge>
                ) : null}
              </div>
              <p className="whitespace-pre-wrap break-words text-sm">
                {version.body}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("terms.publishedOn", {
                  date: formatDate(version.publishedAt),
                  name: version.publishedByName ?? t("detail.notRecorded"),
                })}
              </p>
            </li>
          ))}
        </ul>
      )}
      {publishing ? (
        <PublishTermsDialog
          organizationId={organizationId}
          onClose={() => setPublishing(false)}
        />
      ) : null}
    </section>
  );
}
