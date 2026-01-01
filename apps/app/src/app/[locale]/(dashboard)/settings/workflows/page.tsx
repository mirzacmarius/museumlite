"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
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
import { Checkbox } from "@v1/ui/checkbox";

type WorkflowType = "accession" | "deaccession";

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
        <p className="text-muted-foreground">
          Please select an organization to manage workflows.
        </p>
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

  const renderWorkflowCard = (type: WorkflowType, title: string) => {
    const config = getWorkflowConfig(type);
    const stepCount = config?.steps.length || 0;
    const initiatorCount = config?.canInitiateRoles.length || 0;

    return (
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-6">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-medium text-zinc-100">{title}</h3>
            <p className="mt-1 text-sm text-zinc-400">
              Configure approval steps and initiation permissions.
            </p>
          </div>
          <PermissionGate permission="settings.update">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEditClick(type)}
              className="border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white"
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit Workflow
            </Button>
          </PermissionGate>
        </div>

        <div className="space-y-6">
          <div>
            <h4 className="mb-3 text-sm font-medium text-zinc-300">
              Approval Steps
            </h4>
            {stepCount === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/20 p-4 text-center text-sm text-zinc-500">
                No approval steps configured. Workflow completes automatically.
              </div>
            ) : (
              <div className="space-y-3">
                {config?.steps.map((step, index) => {
                  const role = roles?.find((r) => r._id === step.roleId);
                  return (
                    <div
                      key={`${step.stepNumber}-${step.roleId}`}
                      className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3"
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-xs font-medium text-zinc-400">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-zinc-200">
                          {step.name}
                        </div>
                        <div className="text-xs text-zinc-500">
                          Role: {role?.name || "Unknown Role"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h4 className="mb-3 text-sm font-medium text-zinc-300">
              Can Initiate
            </h4>
            {initiatorCount === 0 ? (
              <p className="text-sm text-zinc-500">
                No specific roles assigned (admins only).
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {config?.canInitiateRoles.map((roleId) => {
                  const role = roles?.find((r) => r._id === roleId);
                  return (
                    <span
                      key={roleId}
                      className="rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-400"
                    >
                      {role?.name || "Unknown Role"}
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
    <div className="flex w-full flex-col gap-8 bg-zinc-950">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-medium text-zinc-100">
          Workflow Configuration
        </h2>
        <p className="text-sm text-zinc-400">
          Manage approval workflows for critical system actions.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {renderWorkflowCard("accession", "Accession Workflow")}
        {renderWorkflowCard("deaccession", "Deaccession Workflow")}
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto bg-zinc-950 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">
              Edit{" "}
              {editingWorkflow === "accession" ? "Accession" : "Deaccession"}{" "}
              Workflow
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Configure the approval steps and initiation permissions for this
              workflow.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-zinc-200">Approval Steps</Label>
                <Button
                  type="button"
                  onClick={addStep}
                  variant="outline"
                  size="sm"
                  className="h-8 border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                >
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  Add Step
                </Button>
              </div>

              {formData.steps.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/20 p-8 text-center text-sm text-zinc-500">
                  No steps defined. Click "Add Step" to create an approval
                  process.
                </div>
              ) : (
                <div className="space-y-3">
                  {formData.steps.map((step, index) => (
                    <div
                      key={`form-step-${index}-${step.roleId}`}
                      className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900/30 p-4"
                    >
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-medium text-zinc-400 mt-2.5">
                        {index + 1}
                      </div>

                      <div className="flex-1 space-y-3">
                        <div>
                          <Label className="text-xs text-zinc-500">
                            Step Name
                          </Label>
                          <Input
                            value={step.name}
                            onChange={(e) =>
                              updateStep(index, "name", e.target.value)
                            }
                            className="mt-1 border-zinc-800 bg-zinc-950 text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-zinc-700"
                            placeholder="e.g. Curator Approval"
                          />
                        </div>

                        <div>
                          <Label className="text-xs text-zinc-500">
                            Assign Role
                          </Label>
                          <Select
                            value={step.roleId}
                            onValueChange={(value) =>
                              updateStep(index, "roleId", value as Id<"roles">)
                            }
                          >
                            <SelectTrigger className="mt-1 border-zinc-800 bg-zinc-950 text-zinc-200 focus:ring-zinc-700">
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                            <SelectContent className="border-zinc-800 bg-zinc-950 text-zinc-200">
                              {roles?.map((role) => (
                                <SelectItem
                                  key={role._id}
                                  value={role._id}
                                  className="focus:bg-zinc-900 focus:text-zinc-100"
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
                          className="h-6 w-6 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                          onClick={() => moveStep(index, "up")}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                          onClick={() => moveStep(index, "down")}
                          disabled={index === formData.steps.length - 1}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-zinc-500 hover:text-red-400 hover:bg-red-950/30"
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
              <Label className="text-zinc-200">Can Initiate Workflow</Label>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
                <div className="grid grid-cols-2 gap-3">
                  {roles?.map((role) => (
                    <div key={role._id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`role-${role._id}`}
                        checked={formData.canInitiateRoles.includes(role._id)}
                        onCheckedChange={() => toggleInitiatorRole(role._id)}
                        className="border-zinc-700 data-[state=checked]:bg-zinc-200 data-[state=checked]:text-zinc-900"
                      />
                      <Label
                        htmlFor={`role-${role._id}`}
                        className="text-sm font-normal text-zinc-300 cursor-pointer"
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
                className="border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
              >
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
