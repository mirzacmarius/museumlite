"use client";

import { LOAN_AGREEMENT_TEMPLATE_LIMITS } from "@v1/backend/convex/utils/loanAgreementValidators";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { Dispatch } from "react";
import { useScopedI18n } from "@/locales/client";
import {
  type DraftSection,
  newSectionId,
  type TemplateDraftAction,
} from "./template-draft";

interface TemplateSectionsFieldProps {
  sections: DraftSection[];
  dispatch: Dispatch<TemplateDraftAction>;
}

export function TemplateSectionsField({
  sections,
  dispatch,
}: TemplateSectionsFieldProps) {
  const t = useScopedI18n("loanAgreementTemplates.editor");
  const limits = LOAN_AGREEMENT_TEMPLATE_LIMITS;

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">{t("sections")}</legend>
      {sections.map((section, position) => (
        <div
          key={section.id}
          className="space-y-2 rounded-lg border border-border p-3"
        >
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor={`${section.id}-heading`}>
                {t("sectionHeading")}
              </Label>
              <Input
                id={`${section.id}-heading`}
                value={section.heading}
                maxLength={limits.headingLength}
                onChange={(event) =>
                  dispatch({
                    type: "updateSection",
                    id: section.id,
                    patch: { heading: event.target.value },
                  })
                }
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("moveUp")}
              disabled={position === 0}
              onClick={() =>
                dispatch({ type: "moveSection", id: section.id, offset: -1 })
              }
            >
              <ArrowUp className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("moveDown")}
              disabled={position === sections.length - 1}
              onClick={() =>
                dispatch({ type: "moveSection", id: section.id, offset: 1 })
              }
            >
              <ArrowDown className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("removeSection")}
              disabled={sections.length === 1}
              onClick={() =>
                dispatch({ type: "removeSection", id: section.id })
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${section.id}-body`}>{t("sectionBody")}</Label>
            <Textarea
              id={`${section.id}-body`}
              value={section.body}
              rows={5}
              maxLength={limits.bodyLength}
              className="font-mono text-xs"
              onChange={(event) =>
                dispatch({
                  type: "updateSection",
                  id: section.id,
                  patch: { body: event.target.value },
                })
              }
            />
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={sections.length >= limits.sections}
        onClick={() => dispatch({ type: "addSection", id: newSectionId() })}
      >
        <Plus className="mr-2 size-4" />
        {t("addSection")}
      </Button>
    </fieldset>
  );
}
