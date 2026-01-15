"use client";

import { useOrganization } from "@/components/organization-provider";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@v1/ui/tabs";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  Library,
  Loader2,
  RefreshCw,
  Search,
  User,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface SelectedPatron {
  _id: Id<"accounts">;
  firstName?: string;
  lastName?: string;
  cardNumber?: string;
}

interface SelectedCopy {
  copy: {
    _id: Id<"itemCopies">;
    barcode: string;
  };
  item?: {
    title: string;
  } | null;
  circulation?: {
    _id: Id<"circulations">;
    dueDate: number;
    item?: { title: string } | null;
    account?: { firstName?: string; lastName?: string } | null;
  } | null;
}

interface CheckinResult {
  success: boolean;
  fineCreated: boolean;
  fineAmount?: number;
}

export default function LibraryCirculationPage() {
  const { currentOrganizationId, organizations, isLoading } = useOrganization();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatron, setSelectedPatron] = useState<SelectedPatron | null>(
    null,
  );
  const [selectedCopy, setSelectedCopy] = useState<SelectedCopy | null>(null);
  const [isCheckoutDialogOpen, setIsCheckoutDialogOpen] = useState(false);
  const [isCheckinDialogOpen, setIsCheckinDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkinResult, setCheckinResult] = useState<CheckinResult | null>(
    null,
  );

  const isLibraryEnabled = useQuery(
    api.integrations.isEnabled,
    currentOrganizationId
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          integrationId: "library",
        }
      : "skip",
  );

  const librarySubscription = useQuery(
    api.integrations.getSubscription,
    currentOrganizationId
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          integrationId: "library",
        }
      : "skip",
  );

  const isEntitled = librarySubscription?.isEntitled ?? false;

  const statistics = useQuery(
    api.library.circulation.getStatistics,
    currentOrganizationId && isLibraryEnabled && isEntitled
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const overdueItems = useQuery(
    api.library.circulation.listOverdue,
    currentOrganizationId && isLibraryEnabled && isEntitled
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          paginationOpts: { numItems: 10, cursor: null },
        }
      : "skip",
  );

  const activeCheckouts = useQuery(
    api.library.circulation.listActive,
    currentOrganizationId && isLibraryEnabled && isEntitled
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          paginationOpts: { numItems: 20, cursor: null },
        }
      : "skip",
  );

  const copyLookup = useQuery(
    api.library.circulation.getByBarcode,
    currentOrganizationId &&
      searchQuery.trim() &&
      isLibraryEnabled &&
      isEntitled
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          barcode: searchQuery.trim(),
        }
      : "skip",
  );

  const patronLookup = useQuery(
    api.accounts.getByCardNumber,
    currentOrganizationId &&
      searchQuery.trim() &&
      isLibraryEnabled &&
      isEntitled
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          cardNumber: searchQuery.trim(),
        }
      : "skip",
  );

  const checkout = useMutation(api.library.circulation.checkout);
  const checkin = useMutation(api.library.circulation.checkin);
  const renew = useMutation(api.library.circulation.renew);

  const handleScan = async () => {
    if (!searchQuery.trim()) return;

    // Check if it's a patron card
    if (patronLookup) {
      setSelectedPatron(patronLookup);
      setIsCheckoutDialogOpen(true);
      return;
    }

    // Check if it's a copy barcode
    if (copyLookup?.copy) {
      if (copyLookup.circulation) {
        // Item is checked out - show checkin dialog
        setSelectedCopy(copyLookup);
        setIsCheckinDialogOpen(true);
      } else {
        // Item is available - need to select patron first
        setSelectedCopy(copyLookup);
        setIsCheckoutDialogOpen(true);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleScan();
    }
  };

  const handleCheckout = async (
    accountId: Id<"accounts">,
    copyId: Id<"itemCopies">,
  ) => {
    setIsProcessing(true);
    try {
      await checkout({ accountId, copyId });
      setIsCheckoutDialogOpen(false);
      setSelectedPatron(null);
      setSelectedCopy(null);
      setSearchQuery("");
    } catch (error) {
      console.error("Checkout failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckin = async (circulationId: Id<"circulations">) => {
    setIsProcessing(true);
    try {
      const result = await checkin({ circulationId });
      setCheckinResult(result);
    } catch (error) {
      console.error("Checkin failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRenew = async (circulationId: Id<"circulations">) => {
    setIsProcessing(true);
    try {
      await renew({ circulationId });
    } catch (error) {
      console.error("Renewal failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
          <Building2 className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">No Organization Found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              You need to create an organization to manage circulation.
            </p>
          </div>
          <Button asChild>
            <Link href="/organizations/new">Create Organization</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
          <Library className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">Select an Organization</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Please select an organization from the dropdown above.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLibraryEnabled === false) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
          <Library className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">Library Not Enabled</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              The Library integration is not enabled for this organization.
            </p>
          </div>
          <Button asChild>
            <Link href="/settings/integrations">Enable Integration</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (isLibraryEnabled === undefined || librarySubscription === undefined) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isEntitled) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
          <Library className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">Subscription Required</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Your organization needs an active subscription to access the
              Library integration.
            </p>
          </div>
          <Button asChild>
            <Link href="/settings/integrations">Manage Subscription</Link>
          </Button>
        </div>
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="flex h-full w-full bg-background px-6">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl flex-col gap-6 py-6">
        {/* Statistics */}
        {statistics && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <BookOpen className="h-4 w-4" />
                <span className="text-sm">Active</span>
              </div>
              <p className="mt-2 text-2xl font-medium">
                {statistics.activeCheckouts}
              </p>
            </div>
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">Overdue</span>
              </div>
              <p className="mt-2 text-2xl font-medium text-destructive">
                {statistics.overdueItems}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="text-sm">Due Soon</span>
              </div>
              <p className="mt-2 text-2xl font-medium">{statistics.dueSoon}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <ArrowUpFromLine className="h-4 w-4" />
                <span className="text-sm">Today Out</span>
              </div>
              <p className="mt-2 text-2xl font-medium">
                {statistics.checkoutsToday}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <ArrowDownToLine className="h-4 w-4" />
                <span className="text-sm">Today In</span>
              </div>
              <p className="mt-2 text-2xl font-medium">
                {statistics.returnsToday}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">Lost</span>
              </div>
              <p className="mt-2 text-2xl font-medium">
                {statistics.lostItems}
              </p>
            </div>
          </div>
        )}

        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          {/* Header */}
          <div className="flex w-full items-center justify-between rounded-lg p-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-medium text-primary">
                Circulation Desk
              </h2>
              <p className="text-sm font-normal text-primary/60">
                Check out, return, and renew library items
              </p>
            </div>
          </div>
          <div className="flex w-full px-6">
            <div className="w-full border-b border-border" />
          </div>

          {/* Quick Scan */}
          <div className="border-b border-border px-6 py-4">
            <Label className="mb-2 block text-sm font-medium">
              Scan Barcode
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Scan patron card or item barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="pl-9"
                  autoFocus
                />
              </div>
              <Button onClick={handleScan} disabled={!searchQuery.trim()}>
                <Search className="mr-2 h-4 w-4" />
                Lookup
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="overdue" className="p-6">
            <TabsList>
              <TabsTrigger value="overdue">
                Overdue ({overdueItems?.page.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="active">
                Active Checkouts ({activeCheckouts?.page.length ?? 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overdue" className="mt-4">
              {overdueItems === undefined ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : overdueItems.page.length === 0 ? (
                <div className="flex h-32 flex-col items-center justify-center gap-2">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                  <p className="text-muted-foreground">No overdue items</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {overdueItems.page.map((item) => (
                    <div
                      key={item._id}
                      className="flex items-center justify-between rounded-lg border border-destructive bg-destructive/5 p-4"
                    >
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-medium">{item.item?.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.account?.firstName} {item.account?.lastName} |{" "}
                            {item.copy?.barcode}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <Badge variant="destructive">
                            {item.daysOverdue} days overdue
                          </Badge>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Due: {formatDate(item.dueDate)}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRenew(item._id)}
                          disabled={isProcessing}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Renew
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="active" className="mt-4">
              {activeCheckouts === undefined ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : activeCheckouts.page.length === 0 ? (
                <div className="flex h-32 flex-col items-center justify-center gap-2">
                  <BookOpen className="h-8 w-8 text-muted-foreground" />
                  <p className="text-muted-foreground">No active checkouts</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeCheckouts.page.map((item) => (
                    <div
                      key={item._id}
                      className="flex items-center justify-between rounded-lg border border-border p-4"
                    >
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-medium">{item.item?.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.account?.firstName} {item.account?.lastName} |{" "}
                            {item.copy?.barcode}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm">
                            Due: {formatDate(item.dueDate)}
                          </p>
                          {item.renewalCount > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Renewed {item.renewalCount}x
                            </p>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRenew(item._id)}
                          disabled={isProcessing}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Renew
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleCheckin(item._id)}
                          disabled={isProcessing}
                        >
                          <ArrowDownToLine className="mr-2 h-4 w-4" />
                          Check In
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Checkout Dialog */}
        <Dialog
          open={isCheckoutDialogOpen}
          onOpenChange={setIsCheckoutDialogOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Check Out Item</DialogTitle>
              <DialogDescription>Confirm checkout details</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {selectedPatron && (
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center gap-3">
                    <User className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium">
                        {selectedPatron.firstName} {selectedPatron.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {selectedPatron.cardNumber}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {selectedCopy?.copy && (
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center gap-3">
                    <BookOpen className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium">
                        {selectedCopy.item?.title || "Unknown Item"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {selectedCopy.copy.barcode}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsCheckoutDialogOpen(false);
                  setSelectedPatron(null);
                  setSelectedCopy(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedPatron && selectedCopy?.copy) {
                    handleCheckout(selectedPatron._id, selectedCopy.copy._id);
                  }
                }}
                disabled={
                  isProcessing || !selectedPatron || !selectedCopy?.copy
                }
              >
                {isProcessing && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Confirm Checkout
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Checkin Dialog */}
        <Dialog
          open={isCheckinDialogOpen}
          onOpenChange={setIsCheckinDialogOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Check In Item</DialogTitle>
              <DialogDescription>
                {checkinResult
                  ? "Item checked in successfully"
                  : "Confirm checkin details"}
              </DialogDescription>
            </DialogHeader>
            {checkinResult ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 py-4">
                  <CheckCircle className="h-12 w-12 text-green-500" />
                </div>
                <p className="text-center">Item returned successfully!</p>
                {checkinResult.fineCreated && (
                  <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
                    <p className="text-center text-destructive">
                      Overdue fine created: $
                      {checkinResult.fineAmount?.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {selectedCopy?.circulation && (
                  <>
                    <div className="rounded-lg border border-border p-4">
                      <p className="font-medium">
                        {selectedCopy.circulation.item?.title}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Barcode: {selectedCopy.copy.barcode}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border p-4">
                      <p className="text-sm text-muted-foreground">
                        Checked out to
                      </p>
                      <p className="font-medium">
                        {selectedCopy.circulation.account?.firstName}{" "}
                        {selectedCopy.circulation.account?.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Due: {formatDate(selectedCopy.circulation.dueDate)}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
            <DialogFooter>
              {checkinResult ? (
                <Button
                  onClick={() => {
                    setIsCheckinDialogOpen(false);
                    setSelectedCopy(null);
                    setCheckinResult(null);
                    setSearchQuery("");
                  }}
                >
                  Done
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsCheckinDialogOpen(false);
                      setSelectedCopy(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (selectedCopy?.circulation) {
                        handleCheckin(selectedCopy.circulation._id);
                      }
                    }}
                    disabled={isProcessing}
                  >
                    {isProcessing && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Confirm Check In
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
