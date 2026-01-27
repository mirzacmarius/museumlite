"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { formatDate } from "@/lib/format-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@v1/ui/avatar";
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
import { Clock, Mail, Trash2, UserCog, UserPlus } from "lucide-react";
import { useState } from "react";

export default function UsersSettingsPage() {
  const locale = useCurrentLocale();
  const t = useScopedI18n("users");
  const tPlaceholders = useScopedI18n("settings.placeholders");
  const { currentOrganizationId } = useOrganization();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [isInviting, setIsInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const users = useQuery(
    api.organizations.listOrganizationUsers,
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

  const pendingInvitations = useQuery(
    api.invitations.listPendingInvitations,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const inviteUser = useMutation(api.organizations.inviteUser);
  const removeUser = useMutation(api.organizations.removeUser);
  const updateUserRole = useMutation(api.organizations.updateUserRole);
  const resendInvitation = useMutation(api.invitations.resendInvitation);
  const cancelInvitation = useMutation(api.invitations.cancelInvitation);

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">{t("selectOrganization")}</p>
      </div>
    );
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!inviteEmail.trim()) {
      setError(t("emailRequired"));
      return;
    }

    if (!selectedRoleId) {
      setError(t("roleRequired"));
      return;
    }

    setIsInviting(true);
    try {
      await inviteUser({
        organizationId: currentOrganizationId as Id<"organizations">,
        email: inviteEmail.trim(),
        roleId: selectedRoleId as Id<"roles">,
      });
      setInviteEmail("");
      setSelectedRoleId("");
      setInviteDialogOpen(false);
    } catch (err) {
      console.error("Error inviting user:", err);
      setError(err instanceof Error ? err.message : t("inviteFailed"));
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!confirm(t("removeConfirm"))) {
      return;
    }

    try {
      await removeUser({
        organizationId: currentOrganizationId as Id<"organizations">,
        userId: userId as Id<"users">,
      });
    } catch (err) {
      console.error("Error removing user:", err);
      alert(err instanceof Error ? err.message : t("removeFailed"));
    }
  };

  const handleUpdateRole = async (userId: string, roleId: string) => {
    try {
      await updateUserRole({
        organizationId: currentOrganizationId as Id<"organizations">,
        userId: userId as Id<"users">,
        roleId: roleId as Id<"roles">,
      });
    } catch (err) {
      console.error("Error updating user role:", err);
      alert(err instanceof Error ? err.message : t("updateRoleFailed"));
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    try {
      const result = await resendInvitation({
        invitationId: invitationId as Id<"organizationInvitations">,
      });
      if ("error" in result) {
        alert(result.error);
      }
    } catch (err) {
      console.error("Error resending invitation:", err);
      alert(err instanceof Error ? err.message : t("resendFailed"));
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!confirm(t("cancelConfirm"))) {
      return;
    }

    try {
      await cancelInvitation({
        invitationId: invitationId as Id<"organizationInvitations">,
      });
    } catch (err) {
      console.error("Error cancelling invitation:", err);
      alert(err instanceof Error ? err.message : t("cancelFailed"));
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex w-full flex-col gap-2">
        <h2 className="text-xl font-medium text-primary">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <div className="flex w-full items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">{t("usersLabel")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("userCount", {
              count: users?.length || 0,
              plural: users?.length !== 1 ? "s" : "",
            })}
          </p>
        </div>
        <PermissionGate permission="users.invite">
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                {t("inviteUser")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleInvite}>
                <DialogHeader>
                  <DialogTitle>{t("inviteUserDialog")}</DialogTitle>
                  <DialogDescription>
                    {t("inviteDescription")}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {error && (
                    <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                      {error}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email">{t("emailAddress")}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder={t("emailPlaceholder")}
                      required
                      aria-label={t("emailAddress")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">{t("role")}</Label>
                    <Select
                      value={selectedRoleId}
                      onValueChange={setSelectedRoleId}
                    >
                      <SelectTrigger id="role">
                        <SelectValue
                          placeholder={tPlaceholders("selectRole")}
                        />
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
                    {t("cancel")}
                  </Button>
                  <Button type="submit" disabled={isInviting}>
                    {isInviting ? t("inviting") : t("inviteUser")}
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
            <p className="text-muted-foreground">{t("loadingUsers")}</p>
          </div>
        ) : users.length === 0 ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-muted-foreground">{t("noUsers")}</p>
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
                      {user.name || user.email || t("unknownUser")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {user.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("joined", {
                        date: formatDate(new Date(user.joinedAt), locale),
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <PermissionGate
                    permission="users.manage_roles"
                    fallback={
                      <div className="flex items-center gap-2">
                        <UserCog className="h-4 w-4 text-muted-foreground" />
                        <span className="w-40 text-sm text-muted-foreground">
                          {user.role.name}
                        </span>
                      </div>
                    }
                  >
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
                  </PermissionGate>
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

      <div className="flex w-full flex-col gap-4">
        <div>
          <h3 className="text-lg font-medium">{t("pendingInvitations")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("pendingInvitationsCount", {
              count: pendingInvitations?.length || 0,
              plural: pendingInvitations?.length !== 1 ? "s" : "",
            })}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card">
          {pendingInvitations === undefined ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-muted-foreground">{t("loadingInvitations")}</p>
            </div>
          ) : pendingInvitations.length === 0 ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-muted-foreground">
                {t("noPendingInvitations")}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {pendingInvitations.map((invitation) => (
                <div
                  key={invitation._id}
                  className="flex items-center justify-between p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <Mail className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{invitation.email}</p>
                      <p className="text-sm text-muted-foreground">
                        {invitation.roleName}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {invitation.isExpired ? (
                          <span className="text-destructive">
                            {t("expired")}
                          </span>
                        ) : (
                          <span>
                            {t("expires", {
                              date: formatDate(
                                new Date(invitation.expiresAt),
                                locale,
                              ),
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <PermissionGate permission="users.invite">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResendInvitation(invitation._id)}
                      >
                        {t("resend")}
                      </Button>
                    </PermissionGate>
                    <PermissionGate permission="users.invite">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancelInvitation(invitation._id)}
                        className="text-destructive hover:text-destructive"
                      >
                        {t("cancelInvitation")}
                      </Button>
                    </PermissionGate>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
