"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
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
  DialogTrigger,
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
import { useState } from "react";

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

interface WorkflowConfig {
  workflowType: WorkflowType;
  steps: WorkflowStep[];
  canInitiateRoles: Id<"roles">[];
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
    steps: WorkflowStep[];
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
      <div className="flex h-full w-full items-center justify-center">
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
      steps: config?.steps ? [...config.steps] : [],
      canInitiateRoles: config?.canInitiateRoles
        ? [...config.canInitiateRoles]
        : [],
    });
    setEditDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorkflow) return;

    setIsSubmitting(true);
    try {
      const indexedSteps = formData.steps.map((step, index) => ({
        ...step,
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

  const getWorkflowTitle = (type: WorkflowType | null): string => {
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
  };

  const renderWorkflowCard = (type: WorkflowType) => {
    const config = getWorkflowConfig(type);
    const stepCount = config?.steps.length || 0;
    const initiatorCount = config?.canInitiateRoles.length || 0;

    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-medium text-foreground">
              {getWorkflowTitle(type)}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("configureSteps")}
            </p>
          </div>
          <PermissionGate permission="settings.update">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEditClick(type)}
              className="border-border bg-muted text-foreground/80 hover:bg-accent hover:text-white"
            >
              <Edit className="mr-2 h-4 w-4" />
              {t("editWorkflow")}
            </Button>
          </PermissionGate>
        </div>

        <div className="space-y-6">
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
                {config?.steps.map((step, index) => {
                  const role = roles?.find((r) => r._id === step.roleId);
                  return (
                    <div
                      key={`${step.stepNumber}-${step.roleId}`}
                      className="flex items-center gap-4 rounded-lg border border-border bg-background/50 p-3"
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
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

          <div>
            <h4 className="mb-3 text-sm font-medium text-foreground/80">
              {t("canInitiate")}
            </h4>
            {initiatorCount === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("noRolesAssigned")}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {config?.canInitiateRoles.map((roleId) => {
                  const role = roles?.find((r) => r._id === roleId);
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
        </div>
      </div>
    );
  };

  return (
    <div className="flex w-full flex-col gap-8 bg-background">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-medium text-foreground">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {renderWorkflowCard("accession")}
        {renderWorkflowCard("deaccession")}
        {renderWorkflowCard("loan")}
        {renderWorkflowCard("acquisition")}
        {renderWorkflowCard("exhibition")}
        {renderWorkflowCard("conservation")}
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto bg-background border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {t("editDialogTitle", {
                workflow: getWorkflowTitle(editingWorkflow),
              })}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t("configureSteps")}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-foreground">{t("approvalSteps")}</Label>
                <Button
                  type="button"
                  onClick={addStep}
                  variant="outline"
                  size="sm"
                  className="h-8 border-border bg-muted text-foreground/80 hover:bg-accent hover:text-white"
                >
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  {t("addStep")}
                </Button>
              </div>

              {formData.steps.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                  {t("noStepsDefined")}
                </div>
              ) : (
                <div className="space-y-3">
                  {formData.steps.map((step, index) => (
                    <div
                      key={`form-step-${index}-${step.roleId}`}
                      className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4"
                    >
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground mt-2.5">
                        {index + 1}
                      </div>

                      <div className="flex-1 space-y-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            {t("stepName")}
                          </Label>
                          <Input
                            value={step.name}
                            onChange={(e) =>
                              updateStep(index, "name", e.target.value)
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
                              updateStep(index, "roleId", value as Id<"roles">)
                            }
                          >
                            <SelectTrigger className="mt-1 border-border bg-background text-foreground focus:ring-ring">
                              <SelectValue
                                placeholder={tPlaceholders("selectRole")}
                              />
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
                          className="h-6 w-6 text-muted-foreground hover:text-foreground/80 hover:bg-accent"
                          onClick={() => moveStep(index, "up")}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground/80 hover:bg-accent"
                          onClick={() => moveStep(index, "down")}
                          disabled={index === formData.steps.length - 1}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-red-400 hover:bg-red-950/30"
                          onClick={() => removeStep(index)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3 pt-2">
              <Label className="text-foreground">
                {t("canInitiateWorkflow")}
              </Label>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="grid grid-cols-2 gap-3">
                  {roles?.map((role) => (
                    <div key={role._id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`role-${role._id}`}
                        checked={formData.canInitiateRoles.includes(role._id)}
                        onCheckedChange={() => toggleInitiatorRole(role._id)}
                        className="border-border data-[state=checked]:bg-zinc-200 data-[state=checked]:text-zinc-900"
                      />
                      <Label
                        htmlFor={`role-${role._id}`}
                        className="text-sm font-normal text-foreground/80 cursor-pointer"
                      >
                        {role.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
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
    </div>
  );
}
