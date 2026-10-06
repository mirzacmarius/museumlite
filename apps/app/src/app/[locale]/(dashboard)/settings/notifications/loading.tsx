import { getScopedI18n } from "@/locales/server";

export default async function NotificationSettingsLoading() {
  const t = await getScopedI18n("untranslatedDashboard.settings");
  return (
    <div className="flex size-full items-center justify-center">
      <p className="text-muted-foreground">{t("loadingNotificationSettings")}</p>
    </div>
  );
}
