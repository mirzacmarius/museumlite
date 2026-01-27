import { useScopedI18n } from "@/locales/client";

export default function NotificationSettingsLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <p className="text-muted-foreground">Loading notification settings...</p>
    </div>
  );
}
