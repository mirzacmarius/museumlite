"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { LOAN_AGREEMENT_TEMPLATE_LIMITS } from "@v1/backend/convex/utils/loanAgreementValidators";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { useMutation } from "convex/react";
import { FileText } from "lucide-react";
import { useReducer } from "react";
import { toast } from "sonner";
import { useLoanAgreementTemplateErrorMessage } from "@/hooks/use-loan-agreement-template-error-message";
import { useStandardLoanAgreementSections } from "@/hooks/use-standard-loan-agreement-sections";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { PlaceholderReference } from "./placeholder-reference";
import {
  initialTemplateDraft,
  templateDraftReducer,
  withSectionIds,
} from "./template-draft";
import {
  type LoanAgreementTemplate,
  TEMPLATE_LANGUAGE_NAMES,
  TEMPLATE_LANGUAGES,
  TEMPLATE_LOAN_TYPES,
  type TemplateLanguage,
  type TemplateLoanType,
} from "./template-options";
import { TemplatePreview } from "./template-preview";
import { TemplateSectionsField } from "./template-sections-field";
import { useAppliesToLabel } from "./use-applies-to-label";

/** Which template the editor is open for; null template means a new one. */
export type TemplateEditorTarget =
  | { open: false }
  | { open: true; template: LoanAgreementTemplate | null };

interface TemplateEditorFormProps {
  organizationId: Id<"organizations">;
  organizationName: string;
  template: LoanAgreementTemplate | null;
  onDone: () => void;
}

function TemplateEditorForm({
  organizationId,
  organizationName,
  template,
  onDone,
}: TemplateEditorFormProps) {
  const t = useScopedI18n("loanAgreementTemplates");
  const locale = useCurrentLocale();
  const appliesToLabel = useAppliesToLabel();
  const errorMessage = useLoanAgreementTemplateErrorMessage();
  const standardSections = useStandardLoanAgreementSections();
  const createTemplate = useMutation(api.loanAgreementTemplates.create);
  const updateTemplate = useMutation(api.loanAgreementTemplates.update);
  const [draft, dispatch] = useReducer(
    templateDraftReducer,
    { template, language: locale },
    initialTemplateDraft,
  );

  const sections = draft.sections.map(({ heading, body }) => ({
    heading,
    body,
  }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    dispatch({ type: "saveStarted" });
    const content = {
      organizationId,
      name: draft.name,
      language: draft.language,
      loanType: draft.loanType,
      sections,
    };
    try {
      if (template) {
        await updateTemplate({ ...content, templateId: template._id });
        toast.success(t("toasts.saved"));
      } else {
        await createTemplate(content);
        toast.success(t("toasts.created"));
      }
      onDone();
    } catch (error) {
      dispatch({ type: "saveFailed", error: errorMessage(error) });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="loan-agreement-template-name">
              {t("editor.name")}
            </Label>
            <Input
              id="loan-agreement-template-name"
              value={draft.name}
              maxLength={LOAN_AGREEMENT_TEMPLATE_LIMITS.nameLength}
              placeholder={t("editor.namePlaceholder")}
              onChange={(event) =>
                dispatch({ type: "setName", name: event.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="loan-agreement-template-language">
                {t("editor.language")}
              </Label>
              <Select
                value={draft.language}
                onValueChange={(language) =>
                  dispatch({
                    type: "setLanguage",
                    language: language as TemplateLanguage,
                  })
                }
              >
                <SelectTrigger id="loan-agreement-template-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_LANGUAGES.map((language) => (
                    <SelectItem key={language} value={language}>
                      {TEMPLATE_LANGUAGE_NAMES[language]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="loan-agreement-template-applies-to">
                {t("editor.appliesTo")}
              </Label>
              <Select
                value={draft.loanType}
                onValueChange={(loanType) =>
                  dispatch({
                    type: "setLoanType",
                    loanType: loanType as TemplateLoanType,
                  })
                }
              >
                <SelectTrigger id="loan-agreement-template-applies-to">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_LOAN_TYPES.map((loanType) => (
                    <SelectItem key={loanType} value={loanType}>
                      {appliesToLabel(loanType)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              dispatch({
                type: "replaceSections",
                sections: withSectionIds(standardSections),
                language: locale,
              })
            }
          >
            <FileText className="mr-2 size-4" />
            {t("editor.startFromStandard")}
          </Button>
          <TemplateSectionsField
            sections={draft.sections}
            dispatch={dispatch}
          />
          <PlaceholderReference />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("editor.preview")}</p>
          <TemplatePreview
            sections={sections}
            language={draft.language}
            loanType={draft.loanType}
            organizationName={organizationName}
          />
        </div>
      </div>

      {draft.error && (
        <p role="alert" className="text-sm text-destructive">
          {draft.error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          {t("editor.cancel")}
        </Button>
        <Button type="submit" disabled={draft.isSaving}>
          {draft.isSaving ? t("editor.saving") : t("editor.save")}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface TemplateEditorDialogProps {
  organizationId: Id<"organizations">;
  organizationName: string;
  target: TemplateEditorTarget;
  onClose: () => void;
}

export function TemplateEditorDialog({
  organizationId,
  organizationName,
  target,
  onClose,
}: TemplateEditorDialogProps) {
  const t = useScopedI18n("loanAgreementTemplates.editor");
  const template = target.open ? target.template : null;

  return (
    <Dialog open={target.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? t("editTitle") : t("createTitle")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {target.open && (
          <TemplateEditorForm
            key={template?._id ?? "new"}
            organizationId={organizationId}
            organizationName={organizationName}
            template={template}
            onDone={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
