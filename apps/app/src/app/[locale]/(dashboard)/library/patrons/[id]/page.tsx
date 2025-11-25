"use client";

import { useOrganization } from "@/components/organization-provider";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@v1/ui/alert-dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@v1/ui/tabs";
import { Textarea } from "@v1/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  Ban,
  BookOpen,
  Calendar,
  Clock,
  CreditCard,
  DollarSign,
  Edit,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Trash2,
  User,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

type PatronStatus = "active" | "expired" | "suspended" | "blocked" | "inactive";

const STATUS_OPTIONS: { value: PatronStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "suspended", label: "Suspended" },
  { value: "blocked", label: "Blocked" },
  { value: "inactive", label: "Inactive" },
];

export default function PatronDetailPage() {
  const params = useParams();
  const router = useRouter();
  const patronId = params.id as Id<"patrons">;
  const { currentOrganizationId } = useOrganization();

  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<PatronStatus>("active");
  const [blockReason, setBlockReason] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const [isRenewDialogOpen, setIsRenewDialogOpen] = useState(false);
  const [renewalDate, setRenewalDate] = useState("");
  const [isRenewing, setIsRenewing] = useState(false);

  const patron = useQuery(api.library.patrons.get, { patronId });
  const checkoutHistory = useQuery(api.library.patrons.getCheckoutHistory, {
    patronId,
    paginationOpts: { numItems: 20, cursor: null },
  });
  const holds = useQuery(api.library.patrons.getHolds, { patronId });
  const fines = useQuery(api.library.patrons.getFines, {
    patronId,
    includeAll: true,
  });

  const updateStatus = useMutation(api.library.patrons.updateStatus);
  const renewMembership = useMutation(api.library.patrons.renewMembership);
  const deletePatron = useMutation(api.library.patrons.remove);

  const handleStatusChange = async () => {
    setIsUpdatingStatus(true);
    try {
      await updateStatus({
        patronId,
        status: newStatus,
        blockReason:
          newStatus === "blocked" || newStatus === "suspended"
            ? blockReason
            : undefined,
      });
      setIsStatusDialogOpen(false);
      setBlockReason("");
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleRenew = async () => {
    if (!renewalDate) return;
    setIsRenewing(true);
    try {
      await renewMembership({
        patronId,
        newExpirationDate: new Date(renewalDate).getTime(),
      });
      setIsRenewDialogOpen(false);
      setRenewalDate("");
    } catch (error) {
      console.error("Failed to renew membership:", error);
    } finally {
      setIsRenewing(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deletePatron({ patronId });
      router.push("/library/patrons");
    } catch (error) {
      console.error("Failed to delete patron:", error);
    }
  };

  if (patron === undefined) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (patron === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Patron not found</p>
          <Button asChild className="mt-4">
            <Link href="/library/patrons">Back to Patrons</Link>
          </Button>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="default" className="bg-green-500">
            Active
          </Badge>
        );
      case "expired":
        return <Badge variant="secondary">Expired</Badge>;
      case "suspended":
        return (
          <Badge variant="default" className="bg-yellow-500">
            Suspended
          </Badge>
        );
      case "blocked":
        return <Badge variant="destructive">Blocked</Badge>;
      case "inactive":
        return <Badge variant="outline">Inactive</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (timestamp: number | undefined) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleDateString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className="flex h-full w-full bg-secondary px-6 dark:bg-black">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl flex-col gap-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-6 dark:bg-black">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/library/patrons">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-medium">
                  {patron.firstName} {patron.lastName}
                </h1>
                {getStatusBadge(patron.status)}
              </div>
              <p className="font-mono text-sm text-muted-foreground">
                Card: {patron.cardNumber}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setNewStatus(patron.status as PatronStatus);
                setIsStatusDialogOpen(true);
              }}
            >
              <Ban className="mr-2 h-4 w-4" />
              Change Status
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsRenewDialogOpen(true)}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Renew
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/library/patrons/${patronId}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Patron</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this patron? This action
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Info */}
          <div className="space-y-6 lg:col-span-2">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg border border-border bg-card p-4 dark:bg-black">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <BookOpen className="h-4 w-4" />
                  <span className="text-sm">Checkouts</span>
                </div>
                <p className="mt-2 text-2xl font-medium">
                  {patron.activeCheckoutsCount}
                  <span className="text-sm text-muted-foreground">
                    /{patron.borrowingLimit}
                  </span>
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 dark:bg-black">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">Holds</span>
                </div>
                <p className="mt-2 text-2xl font-medium">
                  {patron.activeHoldsCount}
                  <span className="text-sm text-muted-foreground">
                    /{patron.holdLimit}
                  </span>
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 dark:bg-black">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-sm">Fines</span>
                </div>
                <p className="mt-2 text-2xl font-medium">
                  {formatCurrency(patron.outstandingFinesTotal)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 dark:bg-black">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CreditCard className="h-4 w-4" />
                  <span className="text-sm">Total Checkouts</span>
                </div>
                <p className="mt-2 text-2xl font-medium">
                  {patron.totalCheckouts ?? 0}
                </p>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="checkouts" className="w-full">
              <TabsList>
                <TabsTrigger value="checkouts">Current Checkouts</TabsTrigger>
                <TabsTrigger value="holds">Holds</TabsTrigger>
                <TabsTrigger value="fines">Fines</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>

              <TabsContent value="checkouts" className="mt-4">
                <div className="rounded-lg border border-border bg-card dark:bg-black">
                  {checkoutHistory === undefined ? (
                    <div className="flex h-32 items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : checkoutHistory.page.filter(
                      (c) => c.status === "active" || c.status === "overdue",
                    ).length === 0 ? (
                    <div className="flex h-32 items-center justify-center">
                      <p className="text-muted-foreground">
                        No active checkouts
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {checkoutHistory.page
                        .filter(
                          (c) =>
                            c.status === "active" || c.status === "overdue",
                        )
                        .map((checkout) => (
                          <div
                            key={checkout._id}
                            className="flex items-center justify-between p-4"
                          >
                            <div>
                              <p className="font-medium">
                                {checkout.item?.title}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Barcode: {checkout.copy?.barcode}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm">
                                Due: {formatDate(checkout.dueDate)}
                              </p>
                              {checkout.status === "overdue" && (
                                <Badge variant="destructive">Overdue</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="holds" className="mt-4">
                <div className="rounded-lg border border-border bg-card dark:bg-black">
                  {holds === undefined ? (
                    <div className="flex h-32 items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : holds.length === 0 ? (
                    <div className="flex h-32 items-center justify-center">
                      <p className="text-muted-foreground">No active holds</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {holds.map((hold) => (
                        <div
                          key={hold._id}
                          className="flex items-center justify-between p-4"
                        >
                          <div>
                            <p className="font-medium">{hold.item?.title}</p>
                            <p className="text-sm text-muted-foreground">
                              Position: #{hold.queuePosition}
                            </p>
                          </div>
                          <div className="text-right">
                            {hold.status === "available" ? (
                              <Badge className="bg-green-500">
                                Ready for Pickup
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Pending</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="fines" className="mt-4">
                <div className="rounded-lg border border-border bg-card dark:bg-black">
                  {fines === undefined ? (
                    <div className="flex h-32 items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : fines.length === 0 ? (
                    <div className="flex h-32 items-center justify-center">
                      <p className="text-muted-foreground">No fines</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {fines.map((fine) => (
                        <div
                          key={fine._id}
                          className="flex items-center justify-between p-4"
                        >
                          <div>
                            <p className="font-medium">{fine.description}</p>
                            <p className="text-sm text-muted-foreground">
                              {fine.item?.title || "General fee"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">
                              {formatCurrency(fine.balance)}
                            </p>
                            {fine.status === "outstanding" ? (
                              <Badge variant="destructive">Outstanding</Badge>
                            ) : fine.status === "paid" ? (
                              <Badge className="bg-green-500">Paid</Badge>
                            ) : (
                              <Badge variant="secondary">{fine.status}</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                <div className="rounded-lg border border-border bg-card dark:bg-black">
                  {checkoutHistory === undefined ? (
                    <div className="flex h-32 items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : checkoutHistory.page.length === 0 ? (
                    <div className="flex h-32 items-center justify-center">
                      <p className="text-muted-foreground">
                        No checkout history
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {checkoutHistory.page.map((checkout) => (
                        <div
                          key={checkout._id}
                          className="flex items-center justify-between p-4"
                        >
                          <div>
                            <p className="font-medium">
                              {checkout.item?.title}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Checked out: {formatDate(checkout.checkoutDate)}
                            </p>
                          </div>
                          <div className="text-right">
                            {checkout.returnDate ? (
                              <p className="text-sm">
                                Returned: {formatDate(checkout.returnDate)}
                              </p>
                            ) : (
                              <Badge
                                variant={
                                  checkout.status === "overdue"
                                    ? "destructive"
                                    : "secondary"
                                }
                              >
                                {checkout.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Info */}
            <div className="rounded-lg border border-border bg-card dark:bg-black">
              <div className="border-b border-border p-6">
                <h2 className="text-lg font-medium">Contact Information</h2>
              </div>
              <div className="space-y-4 p-6">
                {patron.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{patron.email}</span>
                  </div>
                )}
                {patron.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{patron.phone}</span>
                  </div>
                )}
                {patron.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div className="text-sm">
                      <p>{patron.address.street}</p>
                      <p>
                        {patron.address.city}
                        {patron.address.state && `, ${patron.address.state}`}{" "}
                        {patron.address.postalCode}
                      </p>
                      {patron.address.country && (
                        <p>{patron.address.country}</p>
                      )}
                    </div>
                  </div>
                )}
                {patron.dateOfBirth && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      Born: {formatDate(patron.dateOfBirth)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Membership */}
            <div className="rounded-lg border border-border bg-card dark:bg-black">
              <div className="border-b border-border p-6">
                <h2 className="text-lg font-medium">Membership</h2>
              </div>
              <div className="space-y-4 p-6">
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-medium">{patron.membershipType}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Registered</p>
                  <p className="font-medium">
                    {formatDate(patron.registrationDate)}
                  </p>
                </div>
                {patron.expirationDate && (
                  <div>
                    <p className="text-sm text-muted-foreground">Expires</p>
                    <p className="font-medium">
                      {formatDate(patron.expirationDate)}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">
                    Borrowing Limit
                  </p>
                  <p className="font-medium">{patron.borrowingLimit} items</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Hold Limit</p>
                  <p className="font-medium">{patron.holdLimit} items</p>
                </div>
              </div>
            </div>

            {/* Block Reason */}
            {patron.blockReason && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
                <p className="text-sm font-medium text-destructive">
                  Block Reason
                </p>
                <p className="mt-1 text-sm">{patron.blockReason}</p>
              </div>
            )}

            {/* Notes */}
            {patron.notes && (
              <div className="rounded-lg border border-border bg-card dark:bg-black">
                <div className="border-b border-border p-6">
                  <h2 className="text-lg font-medium">Notes</h2>
                </div>
                <div className="p-6">
                  <p className="whitespace-pre-wrap text-sm">{patron.notes}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Change Status Dialog */}
        <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Patron Status</DialogTitle>
              <DialogDescription>
                Update the status of this patron account
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={newStatus}
                  onValueChange={(value: PatronStatus) => setNewStatus(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(newStatus === "blocked" || newStatus === "suspended") && (
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Textarea
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    placeholder="Enter reason for blocking/suspending..."
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsStatusDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleStatusChange} disabled={isUpdatingStatus}>
                {isUpdatingStatus && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Update Status
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Renew Dialog */}
        <Dialog open={isRenewDialogOpen} onOpenChange={setIsRenewDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Renew Membership</DialogTitle>
              <DialogDescription>
                Set a new expiration date for this patron
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>New Expiration Date</Label>
                <Input
                  type="date"
                  value={renewalDate}
                  onChange={(e) => setRenewalDate(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsRenewDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRenew}
                disabled={isRenewing || !renewalDate}
              >
                {isRenewing && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Renew Membership
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
