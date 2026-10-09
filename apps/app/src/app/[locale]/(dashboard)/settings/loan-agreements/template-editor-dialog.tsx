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
import { useMutation, useQuery } from "convex/react";
import { FileText } from "lucide-react";
import { Suspense, useEffect, useReducer, useRef } from "react";
import { toast } from "sonner";
import { useLoanAgreementTemplateErrorMessage } from "@/hooks/use-loan-agreement-template-error-message";
import {
  loadAgreementDictionary,
  loanAgreementLabels,
} from "@/lib/loan-agreement-labels";
import { standardLoanAgreementSections } from "@/lib/loan-agreement-template";
import { useCurrentLocale, useI18n, useScopedI18n } from "@/locales/client";
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

/** Which template the editor is open for; a null templateId means a new one. */
export type TemplateEditorTarget =
  | { open: false }
  | { open: true; templateId: Id<"loanAgreementTemplates"> | null };

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
  const tRoot = useI18n();
  const t = useScopedI18n("loanAgreementTemplates");
  const locale = useCurrentLocale();
  const appliesToLabel = useAppliesToLabel();
  const errorMessage = useLoanAgreementTemplateErrorMessage();
  const createTemplate = useMutation(api.loanAgreementTemplates.create);
  const updateTemplate = useMutation(api.loanAgreementTemplates.update);
  const [draft, dispatch] = useReducer(
    templateDraftReducer,
    { template, language: locale },
    initialTemplateDraft,
  );
  // A save can finish after this editor closed (and another opened); only the
  // editor that is still open may close the dialog.
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const sections = draft.sections.map(({ heading, body }) => ({
    heading,
    body,
  }));
  const isBlank = draft.sections.every(
    (section) => !section.heading.trim() && !section.body.trim(),
  );

  const startFromStandard = async () => {
    const dictionary = await loadAgreementDictionary(draft.language);
    dispatch({
      type: "replaceSections",
      sections: withSectionIds(
        standardLoanAgreementSections(loanAgreementLabels(dictionary).standard),
      ),
    });
  };

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
      if (isMounted.current) onDone();
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
          {isBlank && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={startFromStandard}
            >
              <FileText className="mr-2 size-4" />
              {t("editor.startFromStandard")}
            </Button>
          )}
          <TemplateSectionsField
            sections={draft.sections}
            dispatch={dispatch}
          />
          <PlaceholderReference />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("editor.preview")}</p>
          <Suspense
            fallback={
              <p className="text-sm text-muted-foreground">
                {tRoot("common.loading")}
              </p>
            }
          >
            <TemplatePreview
              sections={sections}
              language={draft.language}
              loanType={draft.loanType}
              organizationName={organizationName}
            />
          </Suspense>
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
  const tRoot = useI18n();
  const t = useScopedI18n("loanAgreementTemplates");
  const templateId = target.open ? target.templateId : null;
  const template = useQuery(
    api.loanAgreementTemplates.get,
    templateId ? { organizationId, templateId } : "skip",
  );

  let content: React.ReactNode = null;
  if (target.open && !templateId) {
    content = (
      <TemplateEditorForm
        key="new"
        organizationId={organizationId}
        organizationName={organizationName}
        template={null}
        onDone={onClose}
      />
    );
  } else if (target.open && template === undefined) {
    content = (
      <p className="text-sm text-muted-foreground">{tRoot("common.loading")}</p>
    );
  } else if (target.open && template === null) {
    content = (
      <p role="alert" className="text-sm text-destructive">
        {t("errors.templateNotFound")}
      </p>
    );
  } else if (target.open && template) {
    content = (
      <TemplateEditorForm
        key={template._id}
        organizationId={organizationId}
        organizationName={organizationName}
        template={template}
        onDone={onClose}
      />
    );
  }

  return (
    <Dialog open={target.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {templateId ? t("editor.editTitle") : t("editor.createTitle")}
          </DialogTitle>
          <DialogDescription>{t("editor.description")}</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
