"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import { Archive, FileText, Pencil, Plus, RotateCcw, Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLoanAgreementTemplateErrorMessage } from "@/hooks/use-loan-agreement-template-error-message";
import { useI18n, useScopedI18n } from "@/locales/client";
import {
  TemplateEditorDialog,
  type TemplateEditorTarget,
} from "./template-editor-dialog";
import {
  type LoanAgreementTemplateSummary,
  TEMPLATE_LANGUAGE_NAMES,
} from "./template-options";
import { useAppliesToLabel } from "./use-applies-to-label";

interface TemplateRowProps {
  template: LoanAgreementTemplateSummary;
  onEdit: () => void;
  onSetDefault: () => void;
  onArchive: () => void;
}

function TemplateRow({
  template,
  onEdit,
  onSetDefault,
  onArchive,
}: TemplateRowProps) {
  const t = useScopedI18n("loanAgreementTemplates");
  const appliesToLabel = useAppliesToLabel();
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{template.name}</span>
          {template.isDefault && <Badge>{t("defaultBadge")}</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          {appliesToLabel(template.loanType)} ·{" "}
          {TEMPLATE_LANGUAGE_NAMES[template.language]} ·{" "}
          {t("sectionCount", { count: template.sectionCount })}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="mr-2 size-4" />
          {t("actions.edit")}
        </Button>
        {!template.isDefault && (
          <Button variant="outline" size="sm" onClick={onSetDefault}>
            <Star className="mr-2 size-4" />
            {t("actions.setDefault")}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onArchive}>
          <Archive className="mr-2 size-4" />
          {t("actions.archive")}
        </Button>
      </div>
    </li>
  );
}

interface TemplatesManagerProps {
  organizationId: Id<"organizations">;
  organizationName: string;
}

/** Lists the organization's loan agreement templates and their actions. */
export function TemplatesManager({
  organizationId,
  organizationName,
}: TemplatesManagerProps) {
  const tRoot = useI18n();
  const t = useScopedI18n("loanAgreementTemplates");
  const errorMessage = useLoanAgreementTemplateErrorMessage();
  const templates = useQuery(api.loanAgreementTemplates.list, {
    organizationId,
    includeArchived: true,
  });
  const setDefault = useMutation(api.loanAgreementTemplates.setDefault);
  const archive = useMutation(api.loanAgreementTemplates.archive);
  const restore = useMutation(api.loanAgreementTemplates.restore);
  const [editorTarget, setEditorTarget] = useState<TemplateEditorTarget>({
    open: false,
  });

  const runAction = async (action: () => Promise<null>, success: string) => {
    try {
      await action();
      toast.success(success);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  const target = (template: LoanAgreementTemplateSummary) => ({
    organizationId,
    templateId: template._id,
  });

  const active = templates?.filter(({ status }) => status === "active") ?? [];
  const archived =
    templates?.filter(({ status }) => status === "archived") ?? [];

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-medium text-foreground">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Button
          onClick={() => setEditorTarget({ open: true, templateId: null })}
        >
          <Plus className="mr-2 size-4" />
          {t("newTemplate")}
        </Button>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-border p-4">
        <FileText className="mt-0.5 size-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{t("standardAgreement")}</p>
          <p className="text-sm text-muted-foreground">
            {t("standardAgreementDescription")}
          </p>
        </div>
      </div>

      {templates === undefined ? (
        <p className="text-sm text-muted-foreground">
          {tRoot("common.loading")}
        </p>
      ) : active.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {active.map((template) => (
            <TemplateRow
              key={template._id}
              template={template}
              onEdit={() =>
                setEditorTarget({ open: true, templateId: template._id })
              }
              onSetDefault={() =>
                runAction(
                  () => setDefault(target(template)),
                  t("toasts.defaultSet"),
                )
              }
              onArchive={() =>
                runAction(() => archive(target(template)), t("toasts.archived"))
              }
            />
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            {t("archivedHeading")}
          </h3>
          <ul className="flex flex-col gap-2">
            {archived.map((template) => (
              <li
                key={template._id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <span className="flex items-center gap-2 text-sm">
                  {template.name}
                  <Badge variant="outline">{t("archivedBadge")}</Badge>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    runAction(
                      () => restore(target(template)),
                      t("toasts.restored"),
                    )
                  }
                >
                  <RotateCcw className="mr-2 size-4" />
                  {t("actions.restore")}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <TemplateEditorDialog
        organizationId={organizationId}
        organizationName={organizationName}
        target={editorTarget}
        onClose={() => setEditorTarget({ open: false })}
      />
    </div>
  );
}
