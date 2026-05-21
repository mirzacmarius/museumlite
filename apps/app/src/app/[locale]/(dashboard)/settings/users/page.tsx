"use client";

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
import { useMemo, useReducer, useState } from "react";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

interface RoleOption {
  _id: Id<"roles">;
  name: string;
  isSystemRole?: boolean;
}

interface OrganizationUser {
  _id: Id<"users">;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  avatarUrl?: string | null;
  joinedAt: number;
  role: {
    _id: Id<"roles">;
    name: string;
  };
}

interface PendingInvitation {
  _id: Id<"organizationInvitations">;
  email: string;
  roleName: string;
  expiresAt: number;
  inviterName?: string;
  isExpired: boolean;
}

interface InviteState {
  isOpen: boolean;
  email: string;
  selectedRoleId: string;
  isSubmitting: boolean;
  error: string | null;
}

type InviteAction =
  | { type: "open-change"; isOpen: boolean }
  | { type: "email-change"; email: string }
  | { type: "role-change"; roleId: string }
  | { type: "submit-start" }
  | { type: "submit-success" }
  | { type: "submit-error"; error: string }
  | { type: "set-error"; error: string | null }
  | { type: "reset" };

const initialInviteState: InviteState = {
  isOpen: false,
  email: "",
  selectedRoleId: "",
  isSubmitting: false,
  error: null,
};

function inviteReducer(state: InviteState, action: InviteAction): InviteState {
  switch (action.type) {
    case "open-change":
      return action.isOpen ? { ...state, isOpen: true } : initialInviteState;
    case "email-change":
      return { ...state, email: action.email };
    case "role-change":
      return { ...state, selectedRoleId: action.roleId };
    case "submit-start":
      return { ...state, error: null, isSubmitting: true };
    case "submit-success":
    case "reset":
      return initialInviteState;
    case "submit-error":
      return { ...state, error: action.error, isSubmitting: false };
    case "set-error":
      return { ...state, error: action.error };
  }
}

export default function UsersSettingsPage() {
  const locale = useCurrentLocale();
  const t = useScopedI18n("users");
  const tPlaceholders = useScopedI18n("settings.placeholders");
  const { currentOrganizationId } = useOrganization();
  const [inviteState, dispatchInvite] = useReducer(
    inviteReducer,
    initialInviteState,
  );

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
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{t("selectOrganization")}</p>
      </div>
    );
  }

  const organizationId = currentOrganizationId as Id<"organizations">;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inviteState.email.trim()) {
      dispatchInvite({ type: "set-error", error: t("emailRequired") });
      return;
    }

    if (!inviteState.selectedRoleId) {
      dispatchInvite({ type: "set-error", error: t("roleRequired") });
      return;
    }

    dispatchInvite({ type: "submit-start" });
    try {
      await inviteUser({
        organizationId,
        email: inviteState.email.trim(),
        roleId: inviteState.selectedRoleId as Id<"roles">,
      });
      dispatchInvite({ type: "submit-success" });
    } catch (err) {
      console.error("Error inviting user:", err);
      dispatchInvite({
        type: "submit-error",
        error: err instanceof Error ? err.message : t("inviteFailed"),
      });
    }
  };

  const handleRemoveUser = async (userId: Id<"users">) => {
    if (!confirm(t("removeConfirm"))) {
      return;
    }

    try {
      await removeUser({ organizationId, userId });
    } catch (err) {
      console.error("Error removing user:", err);
      alert(err instanceof Error ? err.message : t("removeFailed"));
    }
  };

  const handleUpdateRole = async (userId: Id<"users">, roleId: string) => {
    try {
      await updateUserRole({
        organizationId,
        userId,
        roleId: roleId as Id<"roles">,
      });
    } catch (err) {
      console.error("Error updating user role:", err);
      alert(err instanceof Error ? err.message : t("updateRoleFailed"));
    }
  };

  const handleResendInvitation = async (
    invitationId: Id<"organizationInvitations">,
  ) => {
    try {
      const result = await resendInvitation({ invitationId });
      if ("error" in result) {
        alert(result.error);
      }
    } catch (err) {
      console.error("Error resending invitation:", err);
      alert(err instanceof Error ? err.message : t("resendFailed"));
    }
  };

  const handleCancelInvitation = async (
    invitationId: Id<"organizationInvitations">,
  ) => {
    if (!confirm(t("cancelConfirm"))) {
      return;
    }

    try {
      await cancelInvitation({ invitationId });
    } catch (err) {
      console.error("Error cancelling invitation:", err);
      alert(err instanceof Error ? err.message : t("cancelFailed"));
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <SettingsHeader t={t} />
      <UsersSectionHeader
        inviteState={inviteState}
        roles={roles}
        t={t}
        tPlaceholders={tPlaceholders}
        userCount={users?.length || 0}
        onInvite={handleInvite}
        onInviteAction={dispatchInvite}
      />
      <UsersList
        locale={locale}
        roles={roles}
        t={t}
        users={users}
        onRemoveUser={handleRemoveUser}
        onUpdateRole={handleUpdateRole}
      />
      <PendingInvitationsSection
        invitations={pendingInvitations}
        locale={locale}
        t={t}
        onCancelInvitation={handleCancelInvitation}
        onResendInvitation={handleResendInvitation}
      />
    </div>
  );
}

function SettingsHeader({ t }: { t: ReturnType<typeof useScopedI18n> }) {
  return (
    <div className="flex w-full flex-col gap-2">
      <h2 className="text-xl font-medium text-foreground">{t("title")}</h2>
      <p className="text-sm text-muted-foreground">{t("description")}</p>
    </div>
  );
}

interface UsersSectionHeaderProps {
  userCount: number;
  inviteState: InviteState;
  roles: RoleOption[] | undefined;
  t: ReturnType<typeof useScopedI18n>;
  tPlaceholders: ReturnType<typeof useScopedI18n>;
  onInvite: (e: React.FormEvent) => Promise<void>;
  onInviteAction: React.Dispatch<InviteAction>;
}

function UsersSectionHeader({
  userCount,
  inviteState,
  roles,
  t,
  tPlaceholders,
  onInvite,
  onInviteAction,
}: UsersSectionHeaderProps) {
  return (
    <div className="flex w-full items-center justify-between">
      <div>
        <h3 className="text-lg font-medium">{t("usersLabel")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("userCount", {
            count: userCount,
            plural: userCount !== 1 ? "s" : "",
          })}
        </p>
      </div>
      <PermissionGate permission="users.invite">
        <InviteUserDialog
          inviteState={inviteState}
          roles={roles}
          t={t}
          tPlaceholders={tPlaceholders}
          onInvite={onInvite}
          onInviteAction={onInviteAction}
        />
      </PermissionGate>
    </div>
  );
}

interface InviteUserDialogProps {
  inviteState: InviteState;
  roles: RoleOption[] | undefined;
  t: ReturnType<typeof useScopedI18n>;
  tPlaceholders: ReturnType<typeof useScopedI18n>;
  onInvite: (e: React.FormEvent) => Promise<void>;
  onInviteAction: React.Dispatch<InviteAction>;
}

function InviteUserDialog({
  inviteState,
  roles,
  t,
  tPlaceholders,
  onInvite,
  onInviteAction,
}: InviteUserDialogProps) {
  return (
    <Dialog
      open={inviteState.isOpen}
      onOpenChange={(isOpen) => onInviteAction({ type: "open-change", isOpen })}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 size-4" />
          {t("inviteUser")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onInvite}>
          <DialogHeader>
            <DialogTitle>{t("inviteUserDialog")}</DialogTitle>
            <DialogDescription>{t("inviteDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {inviteState.error && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                {inviteState.error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t("emailAddress")}</Label>
              <Input
                id="email"
                type="email"
                value={inviteState.email}
                onChange={(e) =>
                  onInviteAction({
                    type: "email-change",
                    email: e.target.value,
                  })
                }
                placeholder={t("emailPlaceholder")}
                required
                aria-label={t("emailAddress")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">{t("role")}</Label>
              <Select
                value={inviteState.selectedRoleId}
                onValueChange={(roleId) =>
                  onInviteAction({ type: "role-change", roleId })
                }
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder={tPlaceholders("selectRole")} />
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
              onClick={() => onInviteAction({ type: "reset" })}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={inviteState.isSubmitting}>
              {inviteState.isSubmitting ? t("inviting") : t("inviteUser")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface UsersListProps {
  users: OrganizationUser[] | undefined;
  roles: RoleOption[] | undefined;
  locale: string;
  t: ReturnType<typeof useScopedI18n>;
  onRemoveUser: (userId: Id<"users">) => Promise<void>;
  onUpdateRole: (userId: Id<"users">, roleId: string) => Promise<void>;
}

function UsersList({
  users,
  roles,
  locale,
  t,
  onRemoveUser,
  onUpdateRole,
}: UsersListProps) {
  return (
    <div className="rounded-lg border border-border bg-card">
      {users === undefined ? (
        <EmptyState heightClassName="h-64" label={t("loadingUsers")} />
      ) : users.length === 0 ? (
        <EmptyState heightClassName="h-64" label={t("noUsers")} />
      ) : (
        <div className="divide-y divide-border">
          {users.map((user) => (
            <UserRow
              key={user._id}
              locale={locale}
              roles={roles}
              t={t}
              user={user}
              onRemoveUser={onRemoveUser}
              onUpdateRole={onUpdateRole}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface UserRowProps {
  user: OrganizationUser;
  roles: RoleOption[] | undefined;
  locale: string;
  t: ReturnType<typeof useScopedI18n>;
  onRemoveUser: (userId: Id<"users">) => Promise<void>;
  onUpdateRole: (userId: Id<"users">, roleId: string) => Promise<void>;
}

function UserRow({
  user,
  roles,
  locale,
  t,
  onRemoveUser,
  onUpdateRole,
}: UserRowProps) {
  const joinedDate = useClientFormattedDate(user.joinedAt, locale);

  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex items-center gap-4">
        <Avatar>
          <AvatarImage src={user.avatarUrl ?? user.image ?? undefined} />
          <AvatarFallback>{getUserInitials(user, t)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">
            {user.name || user.email || t("unknownUser")}
          </p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <p className="text-xs text-muted-foreground" suppressHydrationWarning>
            {t("joined", {
              date: joinedDate,
            })}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <PermissionGate
          permission="users.manage_roles"
          fallback={
            <div className="flex items-center gap-2">
              <UserCog className="size-4 text-muted-foreground" />
              <span className="w-40 text-sm text-muted-foreground">
                {user.role.name}
              </span>
            </div>
          }
        >
          <div className="flex items-center gap-2">
            <UserCog className="size-4 text-muted-foreground" />
            <Select
              value={user.role._id}
              onValueChange={(roleId) => onUpdateRole(user._id, roleId)}
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
            onClick={() => onRemoveUser(user._id)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        </PermissionGate>
      </div>
    </div>
  );
}

function getUserInitials(
  user: OrganizationUser,
  t: ReturnType<typeof useScopedI18n>,
) {
  return (
    user.name
      ?.split(" ")
      .map((namePart) => namePart[0])
      .join("")
      .toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    t("unknownUser")[0] ||
    "U"
  );
}

interface PendingInvitationsSectionProps {
  invitations: PendingInvitation[] | undefined;
  locale: string;
  t: ReturnType<typeof useScopedI18n>;
  onCancelInvitation: (
    invitationId: Id<"organizationInvitations">,
  ) => Promise<void>;
  onResendInvitation: (
    invitationId: Id<"organizationInvitations">,
  ) => Promise<void>;
}

function PendingInvitationsSection({
  invitations,
  locale,
  t,
  onCancelInvitation,
  onResendInvitation,
}: PendingInvitationsSectionProps) {
  return (
    <div className="flex w-full flex-col gap-4">
      <div>
        <h3 className="text-lg font-medium">{t("pendingInvitations")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("pendingInvitationsCount", {
            count: invitations?.length || 0,
            plural: invitations?.length !== 1 ? "s" : "",
          })}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card">
        {invitations === undefined ? (
          <EmptyState heightClassName="h-32" label={t("loadingInvitations")} />
        ) : invitations.length === 0 ? (
          <EmptyState
            heightClassName="h-32"
            label={t("noPendingInvitations")}
          />
        ) : (
          <div className="divide-y divide-border">
            {invitations.map((invitation) => (
              <PendingInvitationRow
                key={invitation._id}
                invitation={invitation}
                locale={locale}
                t={t}
                onCancelInvitation={onCancelInvitation}
                onResendInvitation={onResendInvitation}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface PendingInvitationRowProps {
  invitation: PendingInvitation;
  locale: string;
  t: ReturnType<typeof useScopedI18n>;
  onCancelInvitation: (
    invitationId: Id<"organizationInvitations">,
  ) => Promise<void>;
  onResendInvitation: (
    invitationId: Id<"organizationInvitations">,
  ) => Promise<void>;
}

function PendingInvitationRow({
  invitation,
  locale,
  t,
  onCancelInvitation,
  onResendInvitation,
}: PendingInvitationRowProps) {
  const expiresDate = useClientFormattedDate(invitation.expiresAt, locale);

  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex items-center gap-4">
        <div className="flex size-10 items-center justify-center rounded-full bg-muted">
          <Mail className="size-5 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium">{invitation.email}</p>
          <p className="text-sm text-muted-foreground">{invitation.roleName}</p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" />
            {invitation.isExpired ? (
              <span className="text-destructive">{t("expired")}</span>
            ) : (
              <span suppressHydrationWarning>
                {t("expires", {
                  date: expiresDate,
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
            onClick={() => onResendInvitation(invitation._id)}
          >
            {t("resend")}
          </Button>
        </PermissionGate>
        <PermissionGate permission="users.invite">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCancelInvitation(invitation._id)}
            className="text-destructive hover:text-destructive"
          >
            {t("cancelInvitation")}
          </Button>
        </PermissionGate>
      </div>
    </div>
  );
}

function EmptyState({
  heightClassName,
  label,
}: {
  heightClassName: string;
  label: string;
}) {
  return (
    <div className={`flex ${heightClassName} items-center justify-center`}>
      <p className="text-muted-foreground">{label}</p>
    </div>
  );
}

const DATE_FORMATTERS = new Map<string, Intl.DateTimeFormat>([
  ["en-US", new Intl.DateTimeFormat("en-US")],
  ["fr", new Intl.DateTimeFormat("fr")],
  ["es", new Intl.DateTimeFormat("es")],
  ["nb-NO", new Intl.DateTimeFormat("nb-NO")],
  ["ro-RO", new Intl.DateTimeFormat("ro-RO")],
]);

function getDateFormatter(locale: string) {
  const intlLocale = locale === "no" ? "nb-NO" : locale;
  let formatter = DATE_FORMATTERS.get(intlLocale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(intlLocale);
    DATE_FORMATTERS.set(intlLocale, formatter);
  }
  return formatter;
}

function useClientFormattedDate(timestamp: number, locale: string) {
  return useMemo(
    () => getDateFormatter(locale).format(timestamp),
    [locale, timestamp],
  );
}
