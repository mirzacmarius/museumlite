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
import { useMutation, useQuery } from "convex/react";
import {
  AlertCircle,
  ArrowLeft,
  Box,
  Calendar,
  CheckCircle2,
  CircleDot,
  Clock,
  GalleryVerticalEnd,
  Info,
  MapPin,
  Pencil,
  Trash2,
  User,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function ExhibitionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const exhibitionId = params.id as string;
  const { currentOrganizationId } = useOrganization();
  const deleteExhibition = useMutation(api.exhibitions.remove);
  const [isDeleting, setIsDeleting] = useState(false);

  const exhibition = useQuery(api.exhibitions.get, {
    id: exhibitionId as Id<"exhibitions">,
  });

  const workflowHistory = useQuery(
    api.exhibitions.getWorkflowHistory,
    exhibition?.status === "proposed" || exhibition?.workflowStep
      ? { exhibitionId: exhibitionId as Id<"exhibitions"> }
      : "skip",
  );

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <p className="text-muted-foreground">
          Please select an organization to view exhibitions.
        </p>
      </div>
    );
  }

  if (exhibition === undefined) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (exhibition === null) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <p className="text-muted-foreground">Exhibition not found</p>
      </div>
    );
  }

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteExhibition({ id: exhibitionId as Id<"exhibitions"> });
      router.push("/exhibitions");
    } catch (error) {
      console.error("Failed to delete exhibition:", error);
      setIsDeleting(false);
    }
  };

  const isPast = exhibition.endDate && exhibition.endDate < Date.now();
  const isUpcoming = exhibition.startDate > Date.now();

  let timeStatusColor =
    "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  let timeStatusText = "Current";

  if (isPast) {
    timeStatusColor = "bg-muted text-muted-foreground border-border";
    timeStatusText = "Past";
  } else if (isUpcoming) {
    timeStatusColor = "bg-blue-500/10 text-blue-400 border-blue-500/20";
    timeStatusText = "Upcoming";
  }

  const getWorkflowStatusInfo = () => {
    const status = exhibition.status ?? "active";
    switch (status) {
      case "proposed":
        return {
          color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
          icon: CircleDot,
          text: "Pending Approval",
        };
      case "approved":
        return {
          color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
          icon: CheckCircle2,
          text: "Approved",
        };
      case "active":
        return {
          color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          icon: CheckCircle2,
          text: "Active",
        };
      case "closed":
        return {
          color: "bg-muted text-muted-foreground border-border",
          icon: CheckCircle2,
          text: "Closed",
        };
      case "rejected":
        return {
          color: "bg-red-500/10 text-red-400 border-red-500/20",
          icon: XCircle,
          text: "Rejected",
        };
      default:
        return {
          color: "bg-muted text-muted-foreground border-border",
          icon: CircleDot,
          text: status,
        };
    }
  };

  const workflowInfo = getWorkflowStatusInfo();
  const WorkflowIcon = workflowInfo.icon;

  const calculateDuration = () => {
    const now = Date.now();
    const start = exhibition.startDate;
    const end = exhibition.endDate;

    if (isUpcoming) {
      const daysUntilStart = Math.ceil((start - now) / (1000 * 60 * 60 * 24));
      return { label: "Starts in", value: `${daysUntilStart} days` };
    }
    if (isPast && end) {
      const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      return { label: "Duration", value: `${totalDays} days` };
    }
    const daysActive = Math.ceil((now - start) / (1000 * 60 * 60 * 24));
    return { label: "Active for", value: `${daysActive} days` };
  };

  const duration = calculateDuration();

  return (
    <div className="min-h-screen w-full bg-background pb-20">
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-2 text-xs">
          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
            <Link href="/exhibitions">
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            </Link>
          </Button>
          <span className="text-muted-foreground">Exhibitions</span>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium text-foreground truncate max-w-[200px]">
            {exhibition.title}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <PermissionGate permission="collections.update">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="border-border text-foreground/80 hover:bg-muted hover:text-white"
            >
              <Link href={`/exhibitions/${exhibitionId}/edit`}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Edit
              </Link>
            </Button>
          </PermissionGate>

          <PermissionGate permission="collections.delete">
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-900/30 text-red-400 hover:bg-red-950/50 hover:text-red-300 hover:border-red-900/50"
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Delete
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-background border-border sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle className="text-foreground">
                    Delete Exhibition
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Are you sure you want to delete this exhibition record? This
                    action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    className="border-border text-foreground/80 hover:bg-muted"
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="bg-red-900 text-red-100 hover:bg-red-800"
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </PermissionGate>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${timeStatusColor}`}
              >
                {timeStatusText}
              </span>
              {exhibition.status && exhibition.status !== "active" && (
                <span
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${workflowInfo.color}`}
                >
                  <WorkflowIcon className="h-3 w-3" />
                  {workflowInfo.text}
                </span>
              )}
              {exhibition.isLoan && (
                <span className="text-[10px] font-medium text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                  LOAN
                </span>
              )}
            </div>
            <h1 className="text-3xl font-bold text-foreground">
              {exhibition.title}
            </h1>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">
                {duration.label}
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">
              {duration.value}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">
                Status
              </span>
            </div>
            <p className="mt-2 text-lg font-semibold text-foreground capitalize">
              {exhibition.status ?? "Active"}
            </p>
            {exhibition.workflowStep && exhibition.totalWorkflowSteps && (
              <p className="text-xs text-muted-foreground">
                Step {exhibition.workflowStep} of{" "}
                {exhibition.totalWorkflowSteps}
              </p>
            )}
          </div>

          {exhibition.creatorName && (
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">
                  Created by
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-foreground truncate">
                {exhibition.creatorName}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(exhibition._creationTime).toLocaleDateString()}
              </p>
            </div>
          )}

          {exhibition.approverName && exhibition.approvedAt && (
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">
                  Approved by
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-foreground truncate">
                {exhibition.approverName}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(exhibition.approvedAt).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            <div className="rounded-xl border border-border bg-muted/20 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
                <GalleryVerticalEnd className="h-4 w-4" />
                Overview
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                <div>
                  <label className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide">
                    Location
                  </label>
                  <p className="text-sm text-foreground mt-1 flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    {exhibition.location || "—"}
                  </p>
                </div>
                <div>
                  <label className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide">
                    Date Range
                  </label>
                  <p className="text-sm text-foreground mt-1 flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    {new Date(exhibition.startDate).toLocaleDateString()}
                    {exhibition.endDate
                      ? ` — ${new Date(exhibition.endDate).toLocaleDateString()}`
                      : " (Ongoing)"}
                  </p>
                </div>

                {exhibition.isLoan && (
                  <div className="md:col-span-2">
                    <label className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide">
                      Loan Venue
                    </label>
                    <p className="text-sm text-foreground mt-1">
                      {exhibition.loanVenue || "—"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/20 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
                <Info className="h-4 w-4" />
                Notes
              </h2>
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                {exhibition.notes || "No notes available."}
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-muted/20 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
                <Box className="h-4 w-4" />
                Related Object
              </h2>

              {exhibition.collectionId && (
                <div className="group relative rounded-lg border border-border bg-background/50 p-4 transition-all hover:border-border hover:bg-muted/50">
                  <Link
                    href={`/collections/${exhibition.collectionId}`}
                    className="absolute inset-0 z-10"
                  />
                  <h3 className="font-medium text-foreground group-hover:text-white truncate">
                    {exhibition.collectionTitle || "Unknown Object"}
                  </h3>
                  <div className="mt-2 flex items-center text-xs text-muted-foreground group-hover:text-muted-foreground">
                    View object details{" "}
                    <ArrowLeft className="ml-1 h-3 w-3 rotate-180" />
                  </div>
                </div>
              )}
            </div>

            {workflowHistory && workflowHistory.length > 0 && (
              <div className="rounded-xl border border-border bg-muted/20 p-6">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Approval History
                </h2>

                <div className="space-y-4">
                  {workflowHistory.map((item, index) => (
                    <div
                      key={`${item.step}-${item.approvedAt}`}
                      className="relative pl-4 border-l-2 border-border"
                    >
                      <div className="absolute -left-1.5 top-0.5 h-2.5 w-2.5 rounded-full bg-primary" />
                      <div className="text-sm">
                        <p className="font-medium text-foreground">
                          {item.step === 0
                            ? "Created"
                            : item.comment?.startsWith("Rejected")
                              ? "Rejected"
                              : `Step ${item.step} Approved`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.approverName ?? "Unknown user"} •{" "}
                          {new Date(item.approvedAt).toLocaleDateString()}
                        </p>
                        {item.comment &&
                          !item.comment.startsWith("Rejected") && (
                            <p className="mt-1 text-xs text-muted-foreground italic">
                              "{item.comment}"
                            </p>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
