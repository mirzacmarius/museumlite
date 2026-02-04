"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { formatDate } from "@/lib/format-date";
import { useCurrentLocale } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@v1/ui/dialog";
import { EmptyState } from "@v1/ui/empty-state";
import { FeatureGuard } from "@v1/ui/feature-guard";
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
import { Building2, Hammer, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type TaskStatus = "todo" | "in_progress" | "completed" | "blocked";
type TaskType =
  | "lighting"
  | "signage"
  | "mounts"
  | "conservation"
  | "labeling"
  | "security"
  | "av"
  | "other";
type TaskPriority = "low" | "medium" | "high" | "urgent";

const statusColumns: Array<{ status: TaskStatus; label: string }> = [
  { status: "todo", label: "To Do" },
  { status: "in_progress", label: "In Progress" },
  { status: "blocked", label: "Blocked" },
  { status: "completed", label: "Completed" },
];

const priorityColor: Record<TaskPriority, string> = {
  low: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  medium: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  high: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  urgent: "bg-rose-500/10 text-rose-400 border-rose-500/20",
};

export function InstallationsPageClient() {
  const locale = useCurrentLocale();
  const { currentOrganizationId, organizations, isLoading } = useOrganization();
  const { hasFeature } = useFeatureAccess();
  const [selectedExhibitionId, setSelectedExhibitionId] = useState<
    Id<"exhibitions"> | ""
  >("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const exhibitions = useQuery(
    api.exhibitions.listByOrganization,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  useEffect(() => {
    if (!selectedExhibitionId && exhibitions && exhibitions.length > 0) {
      setSelectedExhibitionId(exhibitions[0]?._id ?? "");
    }
  }, [exhibitions, selectedExhibitionId]);

  const tasks = useQuery(
    api.installations.listTasks,
    currentOrganizationId && selectedExhibitionId
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          exhibitionId: selectedExhibitionId as Id<"exhibitions">,
        }
      : "skip",
  );

  const moveTask = useMutation(api.installations.moveTask);
  const blockTask = useMutation(api.installations.blockTask);
  const createTask = useMutation(api.installations.createTask);

  const groupedTasks = useMemo(() => {
    const groups: Record<TaskStatus, typeof tasks> = {
      todo: [],
      in_progress: [],
      blocked: [],
      completed: [],
    };
    if (!tasks) return groups;
    tasks.forEach((task) => {
      groups[task.status].push(task);
    });
    return groups;
  }, [tasks]);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!organizations || organizations.length === 0 || !currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border/60 bg-card p-8">
          <Building2 className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">No Organization Selected</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Please select or create an organization to view installations.
            </p>
          </div>
          <Button asChild>
            <Link href="/organizations/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Organization
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <FeatureGuard
      featureName="Installations"
      isLocked={!hasFeature("installations")}
      tierNeeded="pro"
    >
      <div className="flex h-full w-full bg-background px-4 sm:px-6">
        <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
          <div className="flex w-full flex-col rounded-lg border border-border/60 bg-card">
            <div className="flex w-full flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg p-4 sm:p-6">
              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-medium text-primary">Installations</h2>
                <p className="text-sm font-normal text-primary/60">
                  Track installation tasks by exhibition
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <PermissionGate permission="collections.create">
                  <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        New Task
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[520px]">
                      <DialogHeader>
                        <DialogTitle>New Installation Task</DialogTitle>
                      </DialogHeader>
                      <TaskForm
                        organizationId={currentOrganizationId as Id<"organizations">}
                        exhibitionId={selectedExhibitionId as Id<"exhibitions">}
                        onSubmit={async (payload) => {
                          try {
                            await createTask(payload);
                            toast.success("Task created");
                            setCreateDialogOpen(false);
                          } catch (err) {
                            toast.error(
                              err instanceof Error ? err.message : "Failed to create task",
                            );
                          }
                        }}
                      />
                    </DialogContent>
                  </Dialog>
                </PermissionGate>
              </div>
            </div>

            <div className="flex w-full px-6">
              <div className="w-full border-b border-border/60" />
            </div>

            <div className="p-6 space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="min-w-[240px]">
                  <Label>Exhibition</Label>
                  <Select
                    value={selectedExhibitionId}
                    onValueChange={(value) =>
                      setSelectedExhibitionId(value as Id<"exhibitions">)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select exhibition" />
                    </SelectTrigger>
                    <SelectContent>
                      {exhibitions?.map((exhibition) => (
                        <SelectItem key={exhibition._id} value={exhibition._id}>
                          {exhibition.title}
                        </SelectItem>
                      ))}
                      {!exhibitions ||
                        (exhibitions.length === 0 && (
                          <SelectItem value="none" disabled>
                            No exhibitions available
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-xs text-muted-foreground">
                  {selectedExhibitionId
                    ? "Tasks update in real time for the selected exhibition."
                    : "Select an exhibition to view installation tasks."}
                </div>
              </div>

              {selectedExhibitionId && tasks === undefined && (
                <div className="flex h-48 items-center justify-center">
                  <p className="text-muted-foreground">Loading tasks...</p>
                </div>
              )}

              {selectedExhibitionId && tasks && tasks.length === 0 && (
                <EmptyState
                  title="No installation tasks yet"
                  description="Create the first task to start tracking installation work."
                  icon={<Hammer className="h-10 w-10 text-muted-foreground" />}
                />
              )}

              {selectedExhibitionId && tasks && tasks.length > 0 && (
                <div className="grid gap-4 lg:grid-cols-4">
                  {statusColumns.map((column) => (
                    <div key={column.status} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">
                          {column.label}
                        </h3>
                        <Badge variant="outline" className="text-[10px]">
                          {groupedTasks[column.status]?.length ?? 0}
                        </Badge>
                      </div>
                      <div className="space-y-3">
                        {groupedTasks[column.status]?.map((task) => (
                          <div
                            key={task._id}
                            className="rounded-lg border border-border/60 bg-background/50 p-3 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  {task.title}
                                </p>
                                <p className="text-xs text-muted-foreground capitalize">
                                  {task.taskType.replace("_", " ")}
                                </p>
                              </div>
                              <Badge
                                variant="outline"
                                className={priorityColor[task.priority]}
                              >
                                {task.priority}
                              </Badge>
                            </div>

                            <div className="mt-3 flex flex-col gap-2 text-xs text-muted-foreground">
                              {task.assigneeName && (
                                <span>Assignee: {task.assigneeName}</span>
                              )}
                              {task.dueDate && (
                                <span>
                                  Due {formatDate(new Date(task.dueDate), locale)}
                                </span>
                              )}
                            </div>

                            <div className="mt-3">
                              <Select
                                value={task.status}
                                onValueChange={async (value) => {
                                  if (value === task.status) return;
                                  try {
                                    if (value === "blocked") {
                                      const reason = window.prompt(
                                        "Reason for blocking this task?",
                                      );
                                      if (!reason) return;
                                      await blockTask({ taskId: task._id, reason });
                                    } else {
                                      await moveTask({
                                        taskId: task._id,
                                        status: value as TaskStatus,
                                      });
                                    }
                                    toast.success("Task updated");
                                  } catch (err) {
                                    toast.error(
                                      err instanceof Error ? err.message : "Failed to update task",
                                    );
                                  }
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="todo">To Do</SelectItem>
                                  <SelectItem value="in_progress">
                                    In Progress
                                  </SelectItem>
                                  <SelectItem value="blocked">Blocked</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </FeatureGuard>
  );
}

function TaskForm({
  organizationId,
  exhibitionId,
  onSubmit,
}: {
  organizationId: Id<"organizations">;
  exhibitionId: Id<"exhibitions">;
  onSubmit: (payload: {
    organizationId: Id<"organizations">;
    exhibitionId: Id<"exhibitions">;
    title: string;
    taskType: TaskType;
    priority: TaskPriority;
    assigneeName?: string;
    dueDate?: number;
  }) => Promise<void>;
}) {
  const [form, setForm] = useState({
    title: "",
    taskType: "lighting" as TaskType,
    priority: "medium" as TaskPriority,
    assigneeName: "",
    dueDate: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) {
      toast.error("Task title is required.");
      return;
    }

    const dueDate = form.dueDate ? Date.parse(form.dueDate) : undefined;
    if (form.dueDate && Number.isNaN(dueDate)) {
      toast.error("Please provide a valid due date.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        organizationId,
        exhibitionId,
        title: form.title.trim(),
        taskType: form.taskType,
        priority: form.priority,
        assigneeName: form.assigneeName.trim() || undefined,
        dueDate,
      });
      setForm({
        title: "",
        taskType: "lighting",
        priority: "medium",
        assigneeName: "",
        dueDate: "",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="title">Task Title *</Label>
        <Input
          id="title"
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          placeholder="Install lighting fixtures"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Task Type *</Label>
          <Select
            value={form.taskType}
            onValueChange={(value) =>
              setForm({ ...form, taskType: value as TaskType })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lighting">Lighting</SelectItem>
              <SelectItem value="signage">Signage</SelectItem>
              <SelectItem value="mounts">Mounts</SelectItem>
              <SelectItem value="conservation">Conservation</SelectItem>
              <SelectItem value="labeling">Labeling</SelectItem>
              <SelectItem value="security">Security</SelectItem>
              <SelectItem value="av">AV</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Priority *</Label>
          <Select
            value={form.priority}
            onValueChange={(value) =>
              setForm({ ...form, priority: value as TaskPriority })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="assigneeName">Assignee</Label>
          <Input
            id="assigneeName"
            value={form.assigneeName}
            onChange={(event) =>
              setForm({ ...form, assigneeName: event.target.value })
            }
            placeholder="Team member name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dueDate">Due Date</Label>
          <Input
            id="dueDate"
            type="date"
            value={form.dueDate}
            onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting || !exhibitionId}>
          {isSubmitting ? "Creating..." : "Create Task"}
        </Button>
      </div>
    </form>
  );
}
