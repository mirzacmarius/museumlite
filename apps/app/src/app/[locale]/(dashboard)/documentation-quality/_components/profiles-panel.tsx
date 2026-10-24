"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  isObjectIdProfileName,
  OBJECT_ID_PROFILE_NAME,
  OBJECT_ID_PROFILE_REQUIREMENTS,
  OBJECT_ID_PROFILE_STAGES,
} from "@v1/backend/convex/utils/objectId";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Archive, IdCard, Pencil, Plus, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useQualityErrorMessage } from "@/hooks/use-quality-error-message";
import { useScopedI18n } from "@/locales/client";
import { ProfileDialog } from "./profile-dialog";

type Profile = FunctionReturnType<
  typeof api.documentationQuality.listProfiles
>["profiles"][number];

type Editing = { mode: "create" } | { mode: "edit"; profile: Profile } | null;

function ProfileCard({
  profile,
  canManage,
  onEdit,
}: {
  profile: Profile;
  canManage: boolean;
  onEdit: () => void;
}) {
  const t = useScopedI18n("documentationQuality");
  const errorMessage = useQualityErrorMessage();
  const archiveProfile = useMutation(api.documentationQuality.archiveProfile);
  const restoreProfile = useMutation(api.documentationQuality.restoreProfile);
  const [isWorking, setIsWorking] = useState(false);
  const archived = profile.status === "archived";

  async function setArchived(next: boolean) {
    setIsWorking(true);
    try {
      if (next) await archiveProfile({ profileId: profile._id });
      else await restoreProfile({ profileId: profile._id });
      toast.success(next ? t("profiles.archived") : t("profiles.restored"));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <li className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{profile.name}</h3>
            {archived ? (
              <Badge variant="outline">{t("profiles.archivedBadge")}</Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {profile.objectType ?? t("profiles.allTypes")} ·{" "}
            {profile.stages.map((stage) => t(`stages.${stage}`)).join(", ")}
          </p>
        </div>
        {canManage ? (
          <div className="flex gap-2">
            {archived ? null : (
              <Button
                size="sm"
                variant="outline"
                onClick={onEdit}
                disabled={isWorking}
              >
                <Pencil className="mr-1 size-4" />
                {t("profiles.edit")}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setArchived(!archived)}
              disabled={isWorking}
            >
              {archived ? (
                <RotateCcw className="mr-1 size-4" />
              ) : (
                <Archive className="mr-1 size-4" />
              )}
              {archived ? t("profiles.restore") : t("profiles.archive")}
            </Button>
          </div>
        ) : null}
      </div>
      <ul
        className="flex flex-wrap gap-1.5"
        aria-label={t("profiles.fields.requirements")}
      >
        {profile.requirements.map((requirement) => (
          <li key={requirement}>
            <Badge variant="secondary">
              {t(`requirements.${requirement}`)}
            </Badge>
          </li>
        ))}
      </ul>
    </li>
  );
}

/**
 * Offers the Object ID profile until the institution has one: the checklist
 * categories and a photograph, for objects in the collection or borrowed.
 */
function ObjectIdProfileOffer({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("documentationQuality.profiles");
  const errorMessage = useQualityErrorMessage();
  const createProfile = useMutation(api.documentationQuality.createProfile);
  const [isAdding, setIsAdding] = useState(false);

  async function addProfile() {
    setIsAdding(true);
    try {
      await createProfile({
        organizationId,
        name: OBJECT_ID_PROFILE_NAME,
        stages: [...OBJECT_ID_PROFILE_STAGES],
        requirements: [...OBJECT_ID_PROFILE_REQUIREMENTS],
      });
      toast.success(t("objectId.added"));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="max-w-2xl text-sm text-muted-foreground">
        {t("objectId.hint")}
      </p>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0"
        onClick={addProfile}
        disabled={isAdding}
      >
        <IdCard className="mr-1 size-4" />
        {t("objectId.add")}
      </Button>
    </div>
  );
}

/** The institution's documentation profiles; administrators change them. */
export function ProfilesPanel({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("documentationQuality.profiles");
  const result = useQuery(api.documentationQuality.listProfiles, {
    organizationId,
  });
  const [editing, setEditing] = useState<Editing>(null);
  const hasObjectIdProfile =
    result?.profiles.some(
      (profile) =>
        profile.status === "active" && isObjectIdProfileName(profile.name),
    ) ?? true;

  if (result === undefined)
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {t("loading")}
      </p>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t("description")}
        </p>
        {result.canManage ? (
          <Button size="sm" onClick={() => setEditing({ mode: "create" })}>
            <Plus className="mr-1 size-4" />
            {t("add")}
          </Button>
        ) : null}
      </div>
      {result.canManage ? null : (
        <p className="text-xs text-muted-foreground">{t("readOnly")}</p>
      )}
      {result.canManage && !hasObjectIdProfile ? (
        <ObjectIdProfileOffer organizationId={organizationId} />
      ) : null}
      {result.profiles.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {result.profiles.map((profile) => (
            <ProfileCard
              key={profile._id}
              profile={profile}
              canManage={result.canManage}
              onEdit={() => setEditing({ mode: "edit", profile })}
            />
          ))}
        </ul>
      )}
      {editing ? (
        <ProfileDialog
          organizationId={organizationId}
          profile={editing.mode === "edit" ? editing.profile : undefined}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}
