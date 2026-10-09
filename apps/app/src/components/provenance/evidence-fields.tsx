"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { ProvenanceEvidenceInput } from "@v1/backend/convex/utils/provenanceValidators";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Textarea } from "@v1/ui/textarea";
import { useScopedI18n } from "@/locales/client";

export interface EvidenceDraft {
  kind: "citation" | "media";
  citation: string;
  url: string;
  mediaId: Id<"mediaFiles"> | "";
  excerpt: string;
  locator: string;
}

export const EMPTY_EVIDENCE: EvidenceDraft = {
  kind: "citation",
  citation: "",
  url: "",
  mediaId: "",
  excerpt: "",
  locator: "",
};

export interface EvidenceFile {
  _id: Id<"mediaFiles">;
  fileName: string;
}

/** The evidence to send, or null when its source is missing. */
export function evidenceInputFromDraft(
  draft: EvidenceDraft,
): ProvenanceEvidenceInput | null {
  const optional = (text: string) => text.trim() || undefined;
  const details = {
    excerpt: optional(draft.excerpt),
    locator: optional(draft.locator),
  };
  if (draft.kind === "media") {
    return draft.mediaId
      ? { source: { kind: "media", mediaId: draft.mediaId }, ...details }
      : null;
  }
  const citation = draft.citation.trim();
  return citation
    ? {
        source: { kind: "citation", citation, url: optional(draft.url) },
        ...details,
      }
    : null;
}

interface EvidenceFieldsProps {
  id: string;
  value: EvidenceDraft;
  onChange: (value: EvidenceDraft) => void;
  /** The Object's files; undefined while loading or without media access. */
  files: EvidenceFile[] | undefined;
  disabled?: boolean;
}

/** One source cited for a claim: a citation or a file of the Object. */
export function EvidenceFields({
  id,
  value,
  onChange,
  files,
  disabled = false,
}: EvidenceFieldsProps) {
  const t = useScopedI18n("provenance.evidence");
  const update = (patch: Partial<EvidenceDraft>) =>
    onChange({ ...value, ...patch });
  const canCiteFiles = files !== undefined;

  return (
    <div className="space-y-3">
      {canCiteFiles ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-kind`}>{t("kind")}</Label>
          <Select
            value={value.kind}
            disabled={disabled}
            onValueChange={(kind) =>
              update({ kind: kind as EvidenceDraft["kind"] })
            }
          >
            <SelectTrigger id={`${id}-kind`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="citation">{t("kinds.citation")}</SelectItem>
              <SelectItem value="media">{t("kinds.media")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {value.kind === "media" && canCiteFiles ? (
        files.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noFiles")}</p>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-file`}>{t("file")}</Label>
            <Select
              value={value.mediaId}
              disabled={disabled}
              onValueChange={(mediaId) =>
                update({ mediaId: mediaId as Id<"mediaFiles"> })
              }
            >
              <SelectTrigger id={`${id}-file`}>
                <SelectValue placeholder={t("filePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {files.map((file) => (
                  <SelectItem key={file._id} value={file._id}>
                    {file.fileName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )
      ) : (
        <>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-citation`}>{t("citation")}</Label>
            <Textarea
              id={`${id}-citation`}
              value={value.citation}
              placeholder={t("citationPlaceholder")}
              disabled={disabled}
              rows={2}
              onChange={(event) => update({ citation: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-url`}>{t("url")}</Label>
            <Input
              id={`${id}-url`}
              type="url"
              value={value.url}
              disabled={disabled}
              onChange={(event) => update({ url: event.target.value })}
            />
          </div>
        </>
      )}
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-excerpt`}>{t("excerpt")}</Label>
          <Textarea
            id={`${id}-excerpt`}
            value={value.excerpt}
            placeholder={t("excerptPlaceholder")}
            disabled={disabled}
            rows={2}
            onChange={(event) => update({ excerpt: event.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-locator`}>{t("locator")}</Label>
          <Input
            id={`${id}-locator`}
            value={value.locator}
            disabled={disabled}
            onChange={(event) => update({ locator: event.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
