"use client";

import { useI18n } from "@/locales/client";
import { formatAccessionMethodLabel } from "../../_components/accession-detail-ui";
import type { EditAccessionFormData } from "./edit-accession-form-body";
import { GuideCard } from "./edit-accession-ui";

interface EditAccessionEditSidebarProps {
  formData: EditAccessionFormData;
}

export function EditAccessionEditSidebar({
  formData,
}: EditAccessionEditSidebarProps) {
  const tRoot = useI18n();
  return (
    <div className="space-y-6 xl:sticky xl:top-20 xl:self-start">
      <GuideCard
        title={tRoot("untranslatedRecords.accessions.edit.guidanceTitle")}
        description={tRoot(
          "untranslatedRecords.accessions.edit.guidanceDescription",
        )}
      >
        <div className="space-y-3 text-sm leading-6 text-muted-foreground">
          <p>{tRoot("untranslatedRecords.accessions.edit.sourceGuidance")}</p>
          <p>{tRoot("untranslatedRecords.accessions.edit.methodGuidance")}</p>
          <p>{tRoot("untranslatedRecords.accessions.edit.notesGuidance")}</p>
        </div>
      </GuideCard>

      <GuideCard
        title={tRoot("untranslatedRecords.accessions.edit.reviewSnapshot")}
        description={tRoot(
          "untranslatedRecords.accessions.edit.snapshotDescription",
        )}
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-border/60 bg-background/50 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {tRoot("untranslatedRecords.accessions.edit.sourcePreview")}
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {formData.source ||
                tRoot("untranslatedRecords.accessions.source.noneEntered")}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/50 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {tRoot("untranslatedRecords.accessions.edit.methodPreview")}
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {formatAccessionMethodLabel(formData.method, tRoot)}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/50 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {tRoot("untranslatedRecords.accessions.edit.notesLength")}
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {formData.notes.trim().length > 0
                ? tRoot("untranslatedRecords.accessions.edit.characterCount", {
                    count: formData.notes.trim().length,
                  })
                : tRoot("untranslatedRecords.accessions.edit.noNotes")}
            </p>
          </div>
        </div>
      </GuideCard>
    </div>
  );
}
