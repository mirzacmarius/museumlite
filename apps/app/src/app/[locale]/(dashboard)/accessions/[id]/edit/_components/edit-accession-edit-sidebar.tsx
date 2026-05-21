"use client";

import type { EditAccessionFormData } from "./edit-accession-form-body";
import { GuideCard } from "./edit-accession-ui";

interface EditAccessionEditSidebarProps {
  formData: EditAccessionFormData;
}

export function EditAccessionEditSidebar({
  formData,
}: EditAccessionEditSidebarProps) {
  return (
    <div className="space-y-6 xl:sticky xl:top-20 xl:self-start">
      <GuideCard
        title="Editing guidance"
        description="Keep only decision-relevant information here so approvers can move quickly and trust the record."
      >
        <div className="space-y-3 text-sm leading-6 text-muted-foreground">
          <p>Use the exact source name reviewers expect to validate.</p>
          <p>
            Choose the acquisition method that matches accounting and workflow
            expectations.
          </p>
          <p>Use notes for context, not duplication of the source field.</p>
        </div>
      </GuideCard>

      <GuideCard
        title="Review snapshot"
        description="These fields will stay visible to the reviewer on the accession page."
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-border/60 bg-background/50 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Source preview
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {formData.source || "No source entered yet"}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/50 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Method preview
            </p>
            <p className="mt-2 text-sm font-medium capitalize text-foreground">
              {formData.method}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/50 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Notes length
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {formData.notes.trim().length > 0
                ? `${formData.notes.trim().length} characters`
                : "No notes added"}
            </p>
          </div>
        </div>
      </GuideCard>
    </div>
  );
}
