"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { ScrollArea } from "@v1/ui/scroll-area";
import { useMutation, useQuery } from "convex/react";
import {
  Building2,
  CheckCircle,
  FileCheck,
  GripVertical,
  Plus,
  Search,
  User,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type WorkflowStage = "draft" | "review" | "cataloging" | "approved";

const WORKFLOW_COLUMNS: Array<{
  id: WorkflowStage;
  label: string;
  step: number;
  accentColor: "amber" | "indigo" | "emerald" | "green";
}> = [
  { id: "draft", label: "Draft / Intake", step: 0, accentColor: "amber" },
  { id: "review", label: "Review", step: 1, accentColor: "indigo" },
  { id: "cataloging", label: "Cataloging", step: 2, accentColor: "emerald" },
  { id: "approved", label: "Approved", step: 3, accentColor: "green" },
];

export default function AccessionsPage() {
  const { currentOrganizationId, organizations, isLoading } = useOrganization();
  const [searchQuery, setSearchQuery] = useState("");

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-zinc-950 px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-8">
          <Building2 className="h-12 w-12 text-zinc-500" />
          <div className="text-center">
            <h3 className="text-lg font-semibold text-zinc-200">
              No Organization Found
            </h3>
            <p className="mt-2 text-sm text-zinc-500">
              You need to create an organization to start managing accessions.
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

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-zinc-950 px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-8">
          <FileCheck className="h-12 w-12 text-zinc-500" />
          <div className="text-center">
            <h3 className="text-lg font-semibold text-zinc-200">
              Select an Organization
            </h3>
            <p className="mt-2 text-sm text-zinc-500">
              Please select an organization from the dropdown above to view
              accessions.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-zinc-950">
      <AccessionKanban
        organizationId={currentOrganizationId}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
    </div>
  );
}

type AccessionItem = {
  _id: Id<"accessions">;
  accessionNumber: string;
  dateReceived: number;
  source: string;
  method: string;
  status: string;
  workflowStep?: number;
};

function AccessionKanban({
  organizationId,
  searchQuery,
  onSearchChange,
}: {
  organizationId: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}) {
  const [draggedItem, setDraggedItem] = useState<AccessionItem | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<WorkflowStage | null>(
    null,
  );

  const accessions = useQuery(
    api.accessions.list,
    organizationId
      ? {
          organizationId: organizationId as Id<"organizations">,
          paginationOpts: { numItems: 100, cursor: null },
          search: searchQuery.trim() || undefined,
        }
      : "skip",
  );

  const updateWorkflowStep = useMutation(api.accessions.updateWorkflowStep);
  const approveAccession = useMutation(api.accessions.approve);

  const pendingCount =
    accessions?.page.filter((a) => a.status === "pending").length ?? 0;
  const approvedCount =
    accessions?.page.filter((a) => a.status === "approved").length ?? 0;

  const getAccessionsByColumn = (columnId: WorkflowStage): AccessionItem[] => {
    if (!accessions?.page) return [];

    switch (columnId) {
      case "draft":
        return accessions.page.filter(
          (a) =>
            a.status === "pending" && (!a.workflowStep || a.workflowStep === 0),
        );
      case "review":
        return accessions.page.filter(
          (a) => a.status === "pending" && a.workflowStep === 1,
        );
      case "cataloging":
        return accessions.page.filter(
          (a) => a.status === "pending" && a.workflowStep === 2,
        );
      case "approved":
        return accessions.page
          .filter((a) => a.status === "approved")
          .slice(0, 10);
      default:
        return [];
    }
  };

  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    item: AccessionItem,
  ) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", item._id);
  };

  const handleDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    columnId: WorkflowStage,
  ) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (
    e: React.DragEvent<HTMLDivElement>,
    targetColumn: WorkflowStage,
  ) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (!draggedItem) return;

    const targetColumnConfig = WORKFLOW_COLUMNS.find(
      (c) => c.id === targetColumn,
    );
    if (!targetColumnConfig) return;

    if (draggedItem.status === "approved") {
      setDraggedItem(null);
      return;
    }

    if (targetColumn === "approved") {
      try {
        await approveAccession({ accessionId: draggedItem._id });
      } catch (error) {
        console.error("Failed to approve accession:", error);
      }
    } else {
      const currentStep = draggedItem.workflowStep ?? 0;
      if (currentStep !== targetColumnConfig.step) {
        try {
          await updateWorkflowStep({
            accessionId: draggedItem._id,
            workflowStep: targetColumnConfig.step,
          });
        } catch (error) {
          console.error("Failed to update workflow step:", error);
        }
      }
    }

    setDraggedItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverColumn(null);
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex items-end justify-between">
        <div className="flex gap-8">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Pending
            </span>
            <span className="text-2xl font-semibold tracking-tight text-white">
              {pendingCount}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Approved
            </span>
            <span className="text-2xl font-semibold tracking-tight text-white">
              {approvedCount}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              placeholder="Search accessions..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-64 border-zinc-800 bg-zinc-900/50 pl-9 text-sm placeholder:text-zinc-600"
            />
          </div>
          <PermissionGate permission="collections.create">
            <Button
              asChild
              className="bg-indigo-600 text-white shadow-[0_0_15px_-3px_rgba(99,102,241,0.3)] hover:bg-indigo-500"
            >
              <Link href="/accessions/new">
                <Plus className="mr-2 h-4 w-4" />
                New Accession
              </Link>
            </Button>
          </PermissionGate>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto">
        <div className="flex h-full min-w-max gap-6 pb-4">
          {WORKFLOW_COLUMNS.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              accessions={getAccessionsByColumn(column.id)}
              isDragOver={dragOverColumn === column.id}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              draggedItemId={draggedItem?._id}
            />
          ))}
        </div>
      </div>

      {accessions === undefined && (
        <div className="flex h-64 items-center justify-center">
          <p className="text-zinc-500">Loading accessions...</p>
        </div>
      )}
    </div>
  );
}

function KanbanColumn({
  column,
  accessions,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragStart,
  onDragEnd,
  draggedItemId,
}: {
  column: (typeof WORKFLOW_COLUMNS)[number];
  accessions: AccessionItem[];
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragStart: (
    e: React.DragEvent<HTMLDivElement>,
    item: AccessionItem,
  ) => void;
  onDragEnd: () => void;
  draggedItemId?: Id<"accessions">;
}) {
  const getBorderColor = () => {
    switch (column.accentColor) {
      case "amber":
        return "border-l-amber-500";
      case "indigo":
        return "border-l-indigo-500";
      case "emerald":
        return "border-l-emerald-500";
      case "green":
        return "border-l-green-500";
    }
  };

  const getDropZoneStyles = () => {
    if (isDragOver) {
      switch (column.accentColor) {
        case "amber":
          return "bg-amber-500/5 border-amber-500/30";
        case "indigo":
          return "bg-indigo-500/5 border-indigo-500/30";
        case "emerald":
          return "bg-emerald-500/5 border-emerald-500/30";
        case "green":
          return "bg-green-500/5 border-green-500/30";
      }
    }
    return "border-transparent";
  };

  const isApprovedColumn = column.id === "approved";

  return (
    <div className="flex w-72 flex-col gap-3">
      <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-400">
        <span>{column.label}</span>
        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
          {accessions.length}
        </span>
      </div>

      <div
        className={`flex-1 rounded-lg border-2 border-dashed transition-colors ${getDropZoneStyles()}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <ScrollArea className="h-full p-2">
          <div className="flex flex-col gap-3">
            {accessions.map((accession) => (
              <div
                key={accession._id}
                draggable={!isApprovedColumn}
                onDragStart={(e) => onDragStart(e, accession)}
                onDragEnd={onDragEnd}
                className={`group rounded-lg border border-zinc-800 bg-zinc-900 p-3 shadow-sm transition-all ${
                  isApprovedColumn
                    ? ""
                    : `border-l-2 ${getBorderColor()} cursor-grab active:cursor-grabbing`
                } ${
                  draggedItemId === accession._id
                    ? "opacity-50 ring-2 ring-indigo-500"
                    : "hover:border-zinc-700"
                }`}
              >
                <div className="mb-2 flex items-start justify-between">
                  <span className="font-mono text-[10px] text-zinc-500">
                    {accession.accessionNumber}
                  </span>
                  <div className="flex items-center gap-1">
                    {!isApprovedColumn && (
                      <GripVertical className="h-3 w-3 text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100" />
                    )}
                    {accession.status === "pending" && (
                      <div className="h-1.5 w-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                    )}
                    {accession.status === "approved" && (
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                    )}
                  </div>
                </div>
                <Link
                  href={`/accessions/${accession._id}`}
                  className="block"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="mb-1 text-sm font-medium text-zinc-200 transition-colors hover:text-indigo-400">
                    {accession.source}
                  </p>
                </Link>
                <p className="mb-3 line-clamp-2 text-xs text-zinc-500">
                  {accession.method} acquisition
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/20 text-[9px] font-medium text-indigo-300">
                    <User className="h-3 w-3" />
                  </div>
                  <span className="text-[10px] text-zinc-400">
                    {new Date(accession.dateReceived).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}

            {accessions.length === 0 && (
              <div
                className={`flex h-32 items-center justify-center rounded-lg border border-dashed ${
                  isDragOver ? "border-indigo-500/50" : "border-zinc-800"
                } bg-zinc-900/20`}
              >
                <p className="text-xs text-zinc-600">
                  {isDragOver ? "Drop here" : "No items"}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
