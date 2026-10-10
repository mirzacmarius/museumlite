"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  DEFAULT_DIGEST_DAY,
  DEFAULT_DIGEST_TIME,
} from "@v1/backend/convex/utils/notificationPreferences";
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from "@v1/backend/convex/utils/notificationTypes";
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
import { Switch } from "@v1/ui/switch";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { type FormEvent, useState } from "react";
import { ClientDate } from "@/components/client-date";
import { useOrganization } from "@/components/organization-provider";
import { useClientTimeZone } from "@/hooks/use-client-date-format";
import { useNotificationPreferencesErrorMessage } from "@/hooks/use-notification-error-message";
import { formatScheduleWeekday, SCHEDULE_WEEKDAYS } from "@/lib/format-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

type Preferences = NonNullable<
  FunctionReturnType<typeof api.notifications.getPreferences>
>;
type CategoryMatrix = Preferences["categories"];
type EmailSchedule = Preferences["email"]["schedule"];
type Cadence = EmailSchedule["cadence"];

const NEXT_DIGEST_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

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

/** The schedule for a newly chosen cadence, keeping the time already shown. */
function scheduleForCadence(
  cadence: Cadence,
  current: EmailSchedule,
  timezone: string,
): EmailSchedule {
  const time =
    current.cadence === "instant" ? DEFAULT_DIGEST_TIME : current.time;
  switch (cadence) {
    case "instant":
      return { cadence };
    case "daily":
      return { cadence, time, timezone };
    case "weekly":
      return {
        cadence,
        day: current.cadence === "weekly" ? current.day : DEFAULT_DIGEST_DAY,
        time,
        timezone,
      };
  }
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
    <p>
      {email.channel === "fixture"
        ? t("emailFixture")
        : t("emailTo", { address: email.address })}
    </p>
  );
}

/**
 * When chosen categories are emailed: as notifications happen, or in a daily
 * or weekly digest at a local time in the browser's time zone.
 */
function EmailScheduleFields({
  email,
  schedule,
  timezone,
  onChange,
}: {
  email: Preferences["email"];
  schedule: EmailSchedule;
  timezone: string;
  onChange: (schedule: EmailSchedule) => void;
}) {
  const t = useScopedI18n("notificationSettings.schedule");
  const locale = useCurrentLocale();
  const savedTimezone =
    email.schedule.cadence === "instant" ? null : email.schedule.timezone;
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4 text-sm">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="email-cadence">{t("label")}</Label>
          <Select
            value={schedule.cadence}
            onValueChange={(cadence) =>
              onChange(
                scheduleForCadence(cadence as Cadence, schedule, timezone),
              )
            }
          >
            <SelectTrigger id="email-cadence">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="instant">{t("instant")}</SelectItem>
              <SelectItem value="daily">{t("daily")}</SelectItem>
              <SelectItem value="weekly">{t("weekly")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {schedule.cadence === "weekly" ? (
          <div className="space-y-1">
            <Label htmlFor="digest-day">{t("day")}</Label>
            <Select
              value={String(schedule.day)}
              onValueChange={(day) =>
                onChange({ ...schedule, day: Number(day) })
              }
            >
              <SelectTrigger id="digest-day">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCHEDULE_WEEKDAYS.map((day) => (
                  <SelectItem key={day} value={String(day)}>
                    {formatScheduleWeekday(day, locale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {schedule.cadence === "instant" ? null : (
          <div className="space-y-1">
            <Label htmlFor="digest-time">{t("time")}</Label>
            <Input
              id="digest-time"
              type="time"
              required
              value={schedule.time}
              onChange={(event) =>
                onChange({ ...schedule, time: event.target.value })
              }
            />
          </div>
        )}
      </div>
      {schedule.cadence === "instant" ? null : (
        <p className="text-xs text-muted-foreground">
          {savedTimezone && savedTimezone !== timezone
            ? t("timezoneChange", { saved: savedTimezone, timezone })
            : t("timezone", { timezone })}
        </p>
      )}
      {email.digestUnscheduled ? (
        <p className="font-medium text-foreground">{t("unscheduled")}</p>
      ) : null}
      {email.nextDigest ? (
        <p className="text-muted-foreground">
          {t("next", { count: email.nextDigest.notificationCount })}{" "}
          <ClientDate
            timestamp={email.nextDigest.scheduledFor}
            locale={locale}
            options={NEXT_DIGEST_OPTIONS}
          />
        </p>
      ) : null}
    </div>
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
  const timezone = useClientTimeZone();
  const [edits, setEdits] = useState<Partial<CategoryMatrix>>({});
  const [scheduleEdit, setScheduleEdit] = useState<EmailSchedule | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const categories: CategoryMatrix = { ...preferences.categories, ...edits };
  const schedule = scheduleEdit ?? preferences.email.schedule;
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
        emailSchedule:
          schedule.cadence === "instant" ? schedule : { ...schedule, timezone },
      });
      setEdits({});
      setScheduleEdit(null);
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

      {emailOffered ? (
        <EmailScheduleFields
          email={preferences.email}
          schedule={schedule}
          timezone={timezone}
          onChange={(next) => {
            setScheduleEdit(next);
            setSaveState({ kind: "idle" });
          }}
        />
      ) : null}

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
    <div className="flex h-full min-h-0 w-full flex-col overflow-y-auto bg-background p-4 sm:p-6 custom-scrollbar">
      <div className="mx-auto w-full max-w-3xl">
        <NotificationPreferencesForm
          key={organizationId}
          organizationId={organizationId}
          preferences={preferences}
        />
      </div>
    </div>
  );
}
