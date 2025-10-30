"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@v1/ui/dialog";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useMutation, useQuery } from "convex/react";
import { UserPlus, Trash2, UserCog } from "lucide-react";
import { useState } from "react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@v1/ui/avatar";

export default function UsersSettingsPage() {
  const { currentOrganizationId } = useOrganization();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [isInviting, setIsInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const users = useQuery(
    api.organizations.listOrganizationUsers,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as any }
      : "skip",
  );

  const roles = useQuery(
    api.roles.listRoles,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as any }
      : "skip",
  );

  const inviteUser = useMutation(api.organizations.inviteUser);
  const removeUser = useMutation(api.organizations.removeUser);
  const updateUserRole = useMutation(api.organizations.updateUserRole);

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">
          Please select an organization to manage users.
        </p>
      </div>
    );
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!inviteEmail.trim()) {
      setError("Email is required");
      return;
    }

    if (!selectedRoleId) {
      setError("Role is required");
      return;
    }

    setIsInviting(true);
    try {
      await inviteUser({
        organizationId: currentOrganizationId as any,
        email: inviteEmail.trim(),
        roleId: selectedRoleId as any,
      });
      setInviteEmail("");
      setSelectedRoleId("");
      setInviteDialogOpen(false);
    } catch (err) {
      console.error("Error inviting user:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to invite user. Please try again.",
      );
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (
      !confirm(
        "Are you sure you want to remove this user from the organization?",
      )
    ) {
      return;
    }

    try {
      await removeUser({
        organizationId: currentOrganizationId as any,
        userId: userId as any,
      });
    } catch (err) {
      console.error("Error removing user:", err);
      alert(
        err instanceof Error
          ? err.message
          : "Failed to remove user. Please try again.",
      );
    }
  };

  const handleUpdateRole = async (
    userId: string,
    roleId: string,
  ) => {
    try {
      await updateUserRole({
        organizationId: currentOrganizationId as any,
        userId: userId as any,
        roleId: roleId as any,
      });
    } catch (err) {
      console.error("Error updating user role:", err);
      alert(
        err instanceof Error
          ? err.message
          : "Failed to update user role. Please try again.",
      );
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
        <div className="flex w-full flex-col gap-2">
          <h2 className="text-xl font-medium text-primary">User Management</h2>
          <p className="text-sm text-muted-foreground">
            Manage users and their roles in your organization
          </p>
        </div>
        <div className="flex w-full items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Users</h3>
            <p className="text-sm text-muted-foreground">
              {users?.length || 0} user{users?.length !== 1 ? "s" : ""} in
              this organization
            </p>
          </div>
          <PermissionGate permission="users.invite">
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Invite User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleInvite}>
                  <DialogHeader>
                    <DialogTitle>Invite User</DialogTitle>
                    <DialogDescription>
                      Invite a user to join this organization. They must already
                      have an account.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    {error && (
                      <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                        {error}
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="user@example.com"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select
                        value={selectedRoleId}
                        onValueChange={setSelectedRoleId}
                      >
                        <SelectTrigger id="role">
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles?.map((role) => (
                            <SelectItem key={role._id} value={role._id}>
                              {role.name}
                              {role.isSystemRole && " (System)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setInviteDialogOpen(false);
                        setInviteEmail("");
                        setSelectedRoleId("");
                        setError(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isInviting}>
                      {isInviting ? "Inviting..." : "Invite User"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </PermissionGate>
        </div>

        <div className="rounded-lg border border-border bg-card">
          {users === undefined ? (
            <div className="flex h-64 items-center justify-center">
              <p className="text-muted-foreground">Loading users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="flex h-64 items-center justify-center">
              <p className="text-muted-foreground">No users found</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {users.map((user) => (
                <div
                  key={user._id}
                  className="flex items-center justify-between p-4"
                >
                  <div className="flex items-center gap-4">
                    <Avatar>
                      <AvatarImage src={user.image || undefined} />
                      <AvatarFallback>
                        {user.name
                          ?.split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase() ||
                          (user.email?.[0]?.toUpperCase() ?? "U")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {user.name || user.email || "Unknown User"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {user.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Joined{" "}
                        {new Date(user.joinedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <UserCog className="h-4 w-4 text-muted-foreground" />
                      <Select
                        value={user.role._id}
                        onValueChange={(roleId) =>
                          handleUpdateRole(user._id, roleId)
                        }
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roles?.map((role) => (
                            <SelectItem key={role._id} value={role._id}>
                              {role.name}
                            </SelectItem>
                          )) ?? []}
                        </SelectContent>
                      </Select>
                    </div>
                    <PermissionGate permission="users.remove">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveUser(user._id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </PermissionGate>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
  );
}

