"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Checkbox } from "@v1/ui/checkbox";
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
import { ArrowDown, ArrowUp, Edit, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";

type WorkflowType =
  | "accession"
  | "deaccession"
  | "loan"
  | "acquisition"
  | "exhibition"
  | "conservation";

interface WorkflowStep {
  stepNumber: number;
  roleId: Id<"roles">;
  name: string;
}

interface EditableWorkflowStep extends WorkflowStep {
  clientKey: string;
}

interface WorkflowConfig {
  workflowType: WorkflowType;
  steps: WorkflowStep[];
  canInitiateRoles: Id<"roles">[];
}

interface RoleOption {
  _id: Id<"roles">;
  name: string;
}

const WORKFLOW_TYPES: WorkflowType[] = [
  "accession",
  "deaccession",
  "loan",
  "acquisition",
  "exhibition",
  "conservation",
];

const createStepKey = (workflowType: WorkflowType, step: WorkflowStep) =>
  `${workflowType}-${step.stepNumber}-${step.roleId}-${step.name}`;

const createNewStepKey = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `step-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

type WorkflowsT = ReturnType<typeof useScopedI18n<"workflows">>;
type PlaceholdersT = ReturnType<typeof useScopedI18n<"settings.placeholders">>;

interface WorkflowFormData {
  steps: EditableWorkflowStep[];
  canInitiateRoles: Id<"roles">[];
}

function WorkflowsHeader({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xl font-medium text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function WorkflowStepEditor({
  index,
  isLast,
  onMoveStep,
  onRemoveStep,
  onUpdateStep,
  roles,
  step,
  t,
  tPlaceholders,
}: {
  index: number;
  isLast: boolean;
  onMoveStep: (index: number, direction: "up" | "down") => void;
  onRemoveStep: (index: number) => void;
  onUpdateStep: (
    index: number,
    field: keyof WorkflowStep,
    value: string | number | Id<"roles">,
  ) => void;
  roles: RoleOption[] | undefined;
  step: EditableWorkflowStep;
  t: WorkflowsT;
  tPlaceholders: PlaceholdersT;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
      <div className="mt-2.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
        {index + 1}
      </div>

      <div className="flex-1 space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground">
            {t("stepName")}
          </Label>
          <Input
            value={step.name}
            onChange={(event) =>
              onUpdateStep(index, "name", event.target.value)
            }
            className="mt-1 border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
            placeholder={tPlaceholders("stepName")}
          />
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">
            {t("assignRole")}
          </Label>
          <Select
            value={step.roleId}
            onValueChange={(value) =>
              onUpdateStep(index, "roleId", value as Id<"roles">)
            }
          >
            <SelectTrigger className="mt-1 border-border bg-background text-foreground focus:ring-ring">
              <SelectValue placeholder={tPlaceholders("selectRole")} />
            </SelectTrigger>
            <SelectContent className="border-border bg-background text-foreground">
              {roles?.map((role) => (
                <SelectItem
                  key={role._id}
                  value={role._id}
                  className="focus:bg-muted focus:text-foreground"
                >
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1 pt-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground hover:bg-accent hover:text-foreground/80"
          onClick={() => onMoveStep(index, "up")}
          disabled={index === 0}
        >
          <ArrowUp className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground hover:bg-accent hover:text-foreground/80"
          onClick={() => onMoveStep(index, "down")}
          disabled={isLast}
        >
          <ArrowDown className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground hover:bg-red-950/30 hover:text-red-400"
          onClick={() => onRemoveStep(index)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function WorkflowStepsEditor({
  onAddStep,
  onMoveStep,
  onRemoveStep,
  onUpdateStep,
  roles,
  steps,
  t,
  tPlaceholders,
}: {
  onAddStep: () => void;
  onMoveStep: (index: number, direction: "up" | "down") => void;
  onRemoveStep: (index: number) => void;
  onUpdateStep: (
    index: number,
    field: keyof WorkflowStep,
    value: string | number | Id<"roles">,
  ) => void;
  roles: RoleOption[] | undefined;
  steps: EditableWorkflowStep[];
  t: WorkflowsT;
  tPlaceholders: PlaceholdersT;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-foreground">{t("approvalSteps")}</Label>
        <Button
          type="button"
          onClick={onAddStep}
          variant="outline"
          size="sm"
          className="h-8 border-border bg-muted text-foreground/80 hover:bg-accent hover:text-white"
        >
          <Plus className="mr-2 size-3.5" />
          {t("addStep")}
        </Button>
      </div>

      {steps.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          {t("noStepsDefined")}
        </div>
      ) : (
        <div className="space-y-3">
          {steps.map((step, index) => (
            <WorkflowStepEditor
              key={step.clientKey}
              index={index}
              isLast={index === steps.length - 1}
              onMoveStep={onMoveStep}
              onRemoveStep={onRemoveStep}
              onUpdateStep={onUpdateStep}
              roles={roles}
              step={step}
              t={t}
              tPlaceholders={tPlaceholders}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkflowInitiatorRolesEditor({
  canInitiateRoles,
  onToggleRole,
  roles,
  t,
}: {
  canInitiateRoles: Id<"roles">[];
  onToggleRole: (roleId: Id<"roles">) => void;
  roles: RoleOption[] | undefined;
  t: WorkflowsT;
}) {
  return (
    <div className="space-y-3 pt-2">
      <Label className="text-foreground">{t("canInitiateWorkflow")}</Label>
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <div className="grid grid-cols-2 gap-3">
          {roles?.map((role) => (
            <div key={role._id} className="flex items-center gap-x-2">
              <Checkbox
                id={`role-${role._id}`}
                checked={canInitiateRoles.includes(role._id)}
                onCheckedChange={() => onToggleRole(role._id)}
                className="border-border data-[state=checked]:bg-zinc-200 data-[state=checked]:text-zinc-900"
              />
              <Label
                htmlFor={`role-${role._id}`}
                className="cursor-pointer text-sm font-normal text-foreground/80"
              >
                {role.name}
              </Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WorkflowEditDialog({
  formData,
  isOpen,
  isSubmitting,
  onAddStep,
  onCancel,
  onMoveStep,
  onOpenChange,
  onRemoveStep,
  onSave,
  onToggleInitiatorRole,
  onUpdateStep,
  roles,
  t,
  title,
  tPlaceholders,
}: {
  formData: WorkflowFormData;
  isOpen: boolean;
  isSubmitting: boolean;
  onAddStep: () => void;
  onCancel: () => void;
  onMoveStep: (index: number, direction: "up" | "down") => void;
  onOpenChange: (open: boolean) => void;
  onRemoveStep: (index: number) => void;
  onSave: (event: FormEvent) => void;
  onToggleInitiatorRole: (roleId: Id<"roles">) => void;
  onUpdateStep: (
    index: number,
    field: keyof WorkflowStep,
    value: string | number | Id<"roles">,
  ) => void;
  roles: RoleOption[] | undefined;
  t: WorkflowsT;
  title: string;
  tPlaceholders: PlaceholdersT;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-border bg-background">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {t("editDialogTitle", { workflow: title })}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {t("configureSteps")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSave} className="space-y-6 py-4">
          <WorkflowStepsEditor
            onAddStep={onAddStep}
            onMoveStep={onMoveStep}
            onRemoveStep={onRemoveStep}
            onUpdateStep={onUpdateStep}
            roles={roles}
            steps={formData.steps}
            t={t}
            tPlaceholders={tPlaceholders}
          />

          <WorkflowInitiatorRolesEditor
            canInitiateRoles={formData.canInitiateRoles}
            onToggleRole={onToggleInitiatorRole}
            roles={roles}
            t={t}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="border-border bg-muted text-foreground/80 hover:bg-accent hover:text-white"
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
            >
              {isSubmitting ? t("saving") : t("saveChanges")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function WorkflowsSettingsPage() {
  const t = useScopedI18n("workflows");
  const tPlaceholders = useScopedI18n("settings.placeholders");
  const { currentOrganizationId } = useOrganization();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowType | null>(
    null,
  );
  const [formData, setFormData] = useState<{
    steps: EditableWorkflowStep[];
    canInitiateRoles: Id<"roles">[];
  }>({
    steps: [],
    canInitiateRoles: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const workflows = useQuery(
    api.workflows.list,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const roles = useQuery(
    api.roles.listRoles,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const upsertWorkflow = useMutation(api.workflows.upsert);

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{t("selectOrganization")}</p>
      </div>
    );
  }

  const getWorkflowConfig = (type: WorkflowType) => {
    return workflows?.find((w) => w.workflowType === type);
  };

  const handleEditClick = (type: WorkflowType) => {
    const config = getWorkflowConfig(type);
    setEditingWorkflow(type);
    setFormData({
      steps: config?.steps
        ? config.steps.map((step) => ({
            ...step,
            clientKey: createStepKey(type, step),
          }))
        : [],
      canInitiateRoles: config?.canInitiateRoles
        ? [...config.canInitiateRoles]
        : [],
    });
    setEditDialogOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingWorkflow) return;

    setIsSubmitting(true);
    try {
      const indexedSteps = formData.steps.map((step, index) => ({
        name: step.name,
        roleId: step.roleId,
        stepNumber: index + 1,
      }));

      await upsertWorkflow({
        organizationId: currentOrganizationId as Id<"organizations">,
        workflowType: editingWorkflow,
        steps: indexedSteps,
        canInitiateRoles: formData.canInitiateRoles,
      });
      setEditDialogOpen(false);
    } catch (error) {
      console.error("Failed to save workflow:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addStep = () => {
    if (!roles || roles.length === 0) return;
    setFormData((prev) => ({
      ...prev,
      steps: [
        ...prev.steps,
        {
          stepNumber: prev.steps.length + 1,
          roleId: roles[0]!._id,
          name: `Step ${prev.steps.length + 1}`,
          clientKey: createNewStepKey(),
        },
      ],
    }));
  };

  const removeStep = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index),
    }));
  };

  const moveStep = (index: number, direction: "up" | "down") => {
    setFormData((prev) => {
      const newSteps = [...prev.steps];
      if (direction === "up" && index > 0) {
        const temp = newSteps[index];
        const prevStep = newSteps[index - 1];
        if (temp && prevStep) {
          newSteps[index] = prevStep;
          newSteps[index - 1] = temp;
        }
      } else if (direction === "down" && index < newSteps.length - 1) {
        const temp = newSteps[index];
        const nextStep = newSteps[index + 1];
        if (temp && nextStep) {
          newSteps[index] = nextStep;
          newSteps[index + 1] = temp;
        }
      }
      return { ...prev, steps: newSteps };
    });
  };

  const updateStep = (
    index: number,
    field: keyof WorkflowStep,
    value: string | number | Id<"roles">,
  ) => {
    setFormData((prev) => {
      const newSteps = [...prev.steps];
      const currentStep = newSteps[index];
      if (currentStep) {
        newSteps[index] = { ...currentStep, [field]: value };
      }
      return { ...prev, steps: newSteps };
    });
  };

  const toggleInitiatorRole = (roleId: Id<"roles">) => {
    setFormData((prev) => ({
      ...prev,
      canInitiateRoles: prev.canInitiateRoles.includes(roleId)
        ? prev.canInitiateRoles.filter((id) => id !== roleId)
        : [...prev.canInitiateRoles, roleId],
    }));
  };

  const getWorkflowTitle = (type: WorkflowType | null): string =>
    getWorkflowTitleLabel(type, t);

  return (
    <div className="flex w-full flex-col gap-8 bg-background">
      <WorkflowsHeader title={t("title")} description={t("description")} />

      <div className="grid gap-6 lg:grid-cols-2">
        {WORKFLOW_TYPES.map((type) => (
          <WorkflowCard
            key={type}
            config={getWorkflowConfig(type)}
            roles={roles}
            title={getWorkflowTitle(type)}
            t={t}
            type={type}
            onEdit={handleEditClick}
          />
        ))}
      </div>

      <WorkflowEditDialog
        formData={formData}
        isOpen={editDialogOpen}
        isSubmitting={isSubmitting}
        onAddStep={addStep}
        onCancel={() => setEditDialogOpen(false)}
        onMoveStep={moveStep}
        onOpenChange={setEditDialogOpen}
        onRemoveStep={removeStep}
        onSave={handleSave}
        onToggleInitiatorRole={toggleInitiatorRole}
        onUpdateStep={updateStep}
        roles={roles}
        t={t}
        title={getWorkflowTitle(editingWorkflow)}
        tPlaceholders={tPlaceholders}
      />
    </div>
  );
}

function getWorkflowTitleLabel(
  type: WorkflowType | null,
  t: ReturnType<typeof useScopedI18n<"workflows">>,
): string {
  switch (type) {
    case "accession":
      return t("accession");
    case "deaccession":
      return t("deaccession");
    case "loan":
      return t("loan");
    case "acquisition":
      return t("acquisition");
    case "exhibition":
      return t("exhibition");
    case "conservation":
      return t("conservation");
    default:
      return "";
  }
}

interface WorkflowCardProps {
  type: WorkflowType;
  title: string;
  config: WorkflowConfig | undefined;
  roles: RoleOption[] | undefined;
  t: ReturnType<typeof useScopedI18n<"workflows">>;
  onEdit: (type: WorkflowType) => void;
}

function WorkflowCard({
  type,
  title,
  config,
  roles,
  t,
  onEdit,
}: WorkflowCardProps) {
  const stepCount = config?.steps.length || 0;
  const initiatorCount = config?.canInitiateRoles.length || 0;

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-medium text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("configureSteps")}
          </p>
        </div>
        <PermissionGate permission="organization.manage_settings">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(type)}
            className="border-border bg-muted text-foreground/80 hover:bg-accent hover:text-white"
          >
            <Edit className="mr-2 size-4" />
            {t("editWorkflow")}
          </Button>
        </PermissionGate>
      </div>

      <div className="space-y-6">
        <WorkflowStepsSummary
          steps={config?.steps}
          roles={roles}
          stepCount={stepCount}
          t={t}
        />
        <WorkflowInitiatorsSummary
          roleIds={config?.canInitiateRoles}
          roles={roles}
          initiatorCount={initiatorCount}
          t={t}
        />
      </div>
    </div>
  );
}

interface WorkflowStepsSummaryProps {
  steps: WorkflowStep[] | undefined;
  roles: RoleOption[] | undefined;
  stepCount: number;
  t: ReturnType<typeof useScopedI18n<"workflows">>;
}

function WorkflowStepsSummary({
  steps,
  roles,
  stepCount,
  t,
}: WorkflowStepsSummaryProps) {
  return (
    <div>
      <h4 className="mb-3 text-sm font-medium text-foreground/80">
        {t("approvalSteps")}
      </h4>
      {stepCount === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
          {t("noStepsConfigured")}
        </div>
      ) : (
        <div className="space-y-3">
          {steps?.map((step, index) => {
            const role = roles?.find(
              (roleOption) => roleOption._id === step.roleId,
            );
            return (
              <div
                key={`${step.stepNumber}-${step.roleId}`}
                className="flex items-center gap-4 rounded-lg border border-border bg-background/50 p-3"
              >
                <div className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground">
                    {step.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Role: {role?.name || t("unknownRole")}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface WorkflowInitiatorsSummaryProps {
  roleIds: Id<"roles">[] | undefined;
  roles: RoleOption[] | undefined;
  initiatorCount: number;
  t: ReturnType<typeof useScopedI18n<"workflows">>;
}

function WorkflowInitiatorsSummary({
  roleIds,
  roles,
  initiatorCount,
  t,
}: WorkflowInitiatorsSummaryProps) {
  return (
    <div>
      <h4 className="mb-3 text-sm font-medium text-foreground/80">
        {t("canInitiate")}
      </h4>
      {initiatorCount === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noRolesAssigned")}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {roleIds?.map((roleId) => {
            const role = roles?.find((roleOption) => roleOption._id === roleId);
            return (
              <span
                key={roleId}
                className="rounded-md border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground"
              >
                {role?.name || t("unknownRole")}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
