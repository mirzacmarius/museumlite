"use client";

import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
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
import { useEffect, useState } from "react";

export default function NotificationSettingsPage() {
  const tCommon = useScopedI18n("common");
  const { currentOrganizationId } = useOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    emailEnabled: false,
    emailDigestFrequency: "instant" as "instant" | "daily" | "weekly" | "never",
  });

  const preferences = useQuery(
    api.notifications.getPreferences,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const updatePreferences = useMutation(api.notifications.updatePreferences);

  useEffect(() => {
    if (preferences) {
      setFormData({
        emailEnabled: preferences.emailEnabled,
        emailDigestFrequency: preferences.emailDigestFrequency as
          | "instant"
          | "daily"
          | "weekly"
          | "never",
      });
    }
  }, [preferences]);

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">
          Please select an organization to manage notification settings.
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
          Unable to load notification preferences.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      await updatePreferences({
        organizationId: currentOrganizationId as Id<"organizations">,
        emailEnabled: formData.emailEnabled,
        emailDigestFrequency: formData.emailDigestFrequency,
      });
      setSuccessMessage("Email preferences saved successfully");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update notification preferences",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex w-full flex-col gap-2">
        <h2 className="text-xl font-medium text-foreground">
          Email Notification Settings
        </h2>
        <p className="text-sm text-muted-foreground">
          Configure how you receive email notifications for important events.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="rounded-lg border border-green-600 bg-green-50 dark:bg-green-950/30 p-3 text-sm text-green-600 dark:text-green-400">
            {successMessage}
          </div>
        )}

        {/* Email Notifications */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-medium">Email Notifications</h2>
          <div className="space-y-6">
            {/* Email Enabled Toggle */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="emailEnabled">
                    Enable Email Notifications
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Receive notifications via email for important events
                  </p>
                </div>
                <Switch
                  id="emailEnabled"
                  checked={formData.emailEnabled}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, emailEnabled: checked }))
                  }
                />
              </div>
            </div>

            {/* Email Digest Frequency */}
            <div className="space-y-2">
              <Label htmlFor="emailDigestFrequency">
                Email Delivery Frequency
              </Label>
              <Select
                value={formData.emailDigestFrequency}
                onValueChange={(
                  value: "instant" | "daily" | "weekly" | "never",
                ) =>
                  setFormData((prev) => ({
                    ...prev,
                    emailDigestFrequency: value,
                  }))
                }
                disabled={!formData.emailEnabled}
              >
                <SelectTrigger id="emailDigestFrequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instant">
                    Instant - Send emails immediately
                  </SelectItem>
                  <SelectItem value="daily">
                    Daily - Daily digest of notifications
                  </SelectItem>
                  <SelectItem value="weekly">
                    Weekly - Weekly digest of notifications
                  </SelectItem>
                  <SelectItem value="never">Never - No emails</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose how often you want to receive email notifications
              </p>
            </div>
          </div>
        </div>

        {/* Event Types Info */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-medium">Email Events</h2>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You will receive email notifications for the following events when
              enabled:
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>
                  <strong className="text-primary">Loan Requests:</strong> When
                  your loan request is submitted, approved, or denied
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>
                  <strong className="text-primary">Task Assignments:</strong>{" "}
                  When you are assigned a new task
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save Email Preferences"}
          </Button>
        </div>
      </form>
    </div>
  );
}
