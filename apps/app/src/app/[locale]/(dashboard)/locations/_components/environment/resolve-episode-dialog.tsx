"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
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
import { Textarea } from "@v1/ui/textarea";
import { useMutation } from "convex/react";
import { Loader2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { z } from "zod";
import { useAlertEpisodeErrorMessage } from "@/hooks/use-alert-episode-error-message";
import { useScopedI18n } from "@/locales/client";

const NOTE_MAX_LENGTH = 1000;
const resolutionNote = z.string().trim().min(1).max(NOTE_MAX_LENGTH);

interface ResolveEpisodeDialogProps {
  episodeId: Id<"alertEpisodes">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResolveEpisodeDialog(props: ResolveEpisodeDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {props.open ? <ResolveEpisodeForm {...props} /> : null}
    </Dialog>
  );
}

function ResolveEpisodeForm({
  episodeId,
  onOpenChange,
}: ResolveEpisodeDialogProps) {
  const t = useScopedI18n("locations.environment.resolveDialog");
  const errorMessage = useAlertEpisodeErrorMessage();
  const resolveEpisode = useMutation(
    api.environmentalMonitoring.resolveEpisode,
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = resolutionNote.safeParse(note);
    if (!parsed.success) {
      setError(t("noteRequired"));
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await resolveEpisode({ episodeId, note: parsed.data });
      onOpenChange(false);
    } catch (cause) {
      setError(errorMessage(cause) ?? t("failed"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DialogContent>
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="alert-episode-resolution-note">{t("note")}</Label>
          <Textarea
            id="alert-episode-resolution-note"
            value={note}
            maxLength={NOTE_MAX_LENGTH}
            onChange={(event) => setNote(event.currentTarget.value)}
            placeholder={t("notePlaceholder")}
            aria-invalid={error !== null}
            rows={4}
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {t("submit")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
