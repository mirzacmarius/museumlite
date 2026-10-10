"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from "@v1/backend/convex/utils/notificationTypes";
import { Button } from "@v1/ui/button";
import { Label } from "@v1/ui/label";
import { Switch } from "@v1/ui/switch";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { type FormEvent, useState } from "react";
import { useOrganization } from "@/components/organization-provider";
import { useNotificationPreferencesErrorMessage } from "@/hooks/use-notification-error-message";
import { useScopedI18n } from "@/locales/client";

type Preferences = NonNullable<
  FunctionReturnType<typeof api.notifications.getPreferences>
>;
type CategoryMatrix = Preferences["categories"];

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "failed"; message: string };

function withoutEmail(categories: CategoryMatrix): CategoryMatrix {
  return {
    approvals: { ...categories.approvals, email: false },
    reminders: { ...categories.reminders, email: false },
    alerts: { ...categories.alerts, email: false },
    assignments: { ...categories.assignments, email: false },
    system: { ...categories.system, email: false },
  };
}

function EmailChannelNotice({ email }: { email: Preferences["email"] }) {
  const t = useScopedI18n("notificationSettings");
  if (email.channel === "unavailable") {
    return <p>{t("emailUnavailable")}</p>;
  }
  if (email.address === null) {
    return <p>{t("emailAddressMissing")}</p>;
  }
  return (
    <>
      <p>
        {email.channel === "fixture"
          ? t("emailFixture")
          : t("emailTo", { address: email.address })}
      </p>
      {email.savedDigest ? (
        <p className="font-medium text-foreground">
          {email.savedDigest === "daily"
            ? t("savedDigest.daily")
            : t("savedDigest.weekly")}
        </p>
      ) : null}
    </>
  );
}

function CategoryRow({
  category,
  choice,
  emailOffered,
  onChange,
}: {
  category: NotificationCategory;
  choice: CategoryMatrix[NotificationCategory];
  emailOffered: boolean;
  onChange: (choice: CategoryMatrix[NotificationCategory]) => void;
}) {
  const t = useScopedI18n("notificationSettings");
  const notifyId = `notify-${category}`;
  const emailId = `email-${category}`;
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-foreground">
          {t(`categories.${category}.label`)}
        </p>
        <p className="text-xs text-muted-foreground">
          {t(`categories.${category}.description`)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch
            id={notifyId}
            checked={choice.enabled}
            onCheckedChange={(enabled) =>
              onChange({ enabled, email: enabled && choice.email })
            }
          />
          <Label htmlFor={notifyId}>{t("notify")}</Label>
        </div>
        {emailOffered ? (
          <div className="flex items-center gap-2">
            <Switch
              id={emailId}
              checked={choice.email}
              disabled={!choice.enabled}
              onCheckedChange={(email) => onChange({ ...choice, email })}
            />
            <Label htmlFor={emailId}>{t("email")}</Label>
          </div>
        ) : null}
      </div>
    </li>
  );
}

function NotificationPreferencesForm({
  organizationId,
  preferences,
}: {
  organizationId: Id<"organizations">;
  preferences: Preferences;
}) {
  const t = useScopedI18n("notificationSettings");
  const errorMessage = useNotificationPreferencesErrorMessage();
  const updatePreferences = useMutation(api.notifications.updatePreferences);
  const [edits, setEdits] = useState<Partial<CategoryMatrix>>({});
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const categories: CategoryMatrix = { ...preferences.categories, ...edits };
  const emailOffered =
    preferences.email.channel !== "unavailable" &&
    preferences.email.address !== null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaveState({ kind: "saving" });
    try {
      await updatePreferences({
        organizationId,
        categories: emailOffered ? categories : withoutEmail(categories),
      });
      setEdits({});
      setSaveState({ kind: "saved" });
    } catch (error) {
      setSaveState({ kind: "failed", message: errorMessage(error) });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-medium text-foreground">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <div className="space-y-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        <EmailChannelNotice email={preferences.email} />
      </div>

      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {NOTIFICATION_CATEGORIES.map((category) => (
          <CategoryRow
            key={category}
            category={category}
            choice={categories[category]}
            emailOffered={emailOffered}
            onChange={(choice) => {
              setEdits((current) => ({ ...current, [category]: choice }));
              setSaveState({ kind: "idle" });
            }}
          />
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-end gap-4">
        <p role="status" className="text-sm text-muted-foreground">
          {saveState.kind === "saved" ? t("saved") : null}
        </p>
        {saveState.kind === "failed" ? (
          <p role="alert" className="text-sm text-destructive">
            {saveState.message}
          </p>
        ) : null}
        <Button type="submit" disabled={saveState.kind === "saving"}>
          {saveState.kind === "saving" ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}

export default function NotificationSettingsPage() {
  const tCommon = useScopedI18n("common");
  const t = useScopedI18n("untranslatedDashboard.settings");
  const { currentOrganizationId } = useOrganization();
  const organizationId = currentOrganizationId as Id<"organizations"> | null;
  const preferences = useQuery(
    api.notifications.getPreferences,
    organizationId ? { organizationId } : "skip",
  );

  if (!organizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">
          {t("selectOrganizationNotifications")}
        </p>
      </div>
    );
  }

  if (preferences === undefined) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{tCommon("loading")}</p>
      </div>
    );
  }

  if (preferences === null) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">
          {t("loadNotificationPreferencesFailed")}
        </p>
      </div>
    );
  }

  return (
    <NotificationPreferencesForm
      key={organizationId}
      organizationId={organizationId}
      preferences={preferences}
    />
  );
}
