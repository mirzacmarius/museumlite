"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useQuery, useMutation } from "convex/react";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Pencil,
  Trash2,
  Box,
  GalleryVerticalEnd,
  Info,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@v1/ui/dialog";

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

  let statusColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  let statusText = "Current";

  if (isPast) {
    statusColor = "bg-muted text-muted-foreground border-border";
    statusText = "Past";
  } else if (isUpcoming) {
    statusColor = "bg-blue-500/10 text-blue-400 border-blue-500/20";
    statusText = "Upcoming";
  }

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
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${statusColor}`}
              >
                {statusText}
              </span>
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
          </div>
        </div>
      </div>
    </div>
  );
}
