"use client";

import { api } from "@v1/backend/convex/_generated/api";
import {
  type UiLocale,
  UiLocaleProvider,
  type UiMessages,
} from "@v1/ui/locale";
import { useConvexAuth, useMutation } from "convex/react";
import { type ReactNode, useEffect } from "react";
import { useCurrentLocale, useI18n } from "@/locales/client";

export function AppUiLocaleProvider({ children }: { children: ReactNode }) {
  const locale = useCurrentLocale();
  const translate = useI18n();
  const messages: UiMessages = {
    dialog: { close: translate("ui.dialog.close") },
    sheet: { close: translate("ui.sheet.close") },
    sidebar: {
      title: translate("ui.sidebar.title"),
      description: translate("ui.sidebar.description"),
      toggle: translate("ui.sidebar.toggle"),
      progress: translate("ui.sidebar.progress"),
    },
    command: {
      title: translate("ui.command.title"),
      description: translate("ui.command.description"),
    },
    filters: {
      title: translate("ui.filters.title"),
      search: translate("ui.filters.search"),
      clearAll: translate("ui.filters.clearAll"),
      clearSearch: translate("ui.filters.clearSearch"),
      removeFilter: translate("ui.filters.removeFilter"),
    },
    pagination: {
      loadMore: translate("ui.pagination.loadMore"),
      previous: translate("ui.pagination.previous"),
      next: translate("ui.pagination.next"),
      page: translate("ui.pagination.page"),
      of: translate("ui.pagination.of"),
      rowsPerPage: translate("ui.pagination.rowsPerPage"),
    },
    wizard: {
      progress: translate("ui.wizard.progress"),
      previous: translate("ui.wizard.previous"),
      next: translate("ui.wizard.next"),
      finish: translate("ui.wizard.finish"),
    },
    calendar: {
      selectDate: translate("ui.calendar.selectDate"),
      month: translate("ui.calendar.month"),
      year: translate("ui.calendar.year"),
      today: translate("ui.calendar.today"),
      selected: translate("ui.calendar.selected"),
      previousMonth: translate("ui.calendar.previousMonth"),
      nextMonth: translate("ui.calendar.nextMonth"),
      previousYear: translate("ui.calendar.previousYear"),
      nextYear: translate("ui.calendar.nextYear"),
    },
    datePicker: {
      placeholder: translate("ui.datePicker.placeholder"),
      clear: translate("ui.datePicker.clear"),
      today: translate("ui.datePicker.today"),
      naturalLanguageHint: translate("ui.datePicker.naturalLanguageHint"),
      invalidDate: translate("ui.datePicker.invalidDate"),
    },
    lightbox: {
      image: translate("ui.lightbox.image"),
      zoomIn: translate("ui.lightbox.zoomIn"),
      zoomOut: translate("ui.lightbox.zoomOut"),
      download: translate("ui.lightbox.download"),
      close: translate("ui.lightbox.close"),
      previousImage: translate("ui.lightbox.previousImage"),
      nextImage: translate("ui.lightbox.nextImage"),
      thumbnail: translate("ui.lightbox.thumbnail"),
    },
    gallery: {
      closeImageView: translate("ui.gallery.closeImageView"),
      viewImage: translate("ui.gallery.viewImage"),
      moreImages: translate("ui.gallery.moreImages"),
    },
    chart: { loading: translate("ui.chart.loading") },
    tagList: { more: translate("ui.tagList.more") },
    timeline: { today: translate("ui.timeline.today") },
    sonner: {
      notifications: translate("ui.sonner.notifications"),
      close: translate("ui.sonner.close"),
    },
    card: { title: translate("ui.card.title") },
    status: {
      saving: translate("ui.status.saving"),
      saved: translate("ui.status.saved"),
      unsaved: translate("ui.status.unsaved"),
      error: translate("ui.status.error"),
      save: translate("ui.status.save"),
      cancel: translate("ui.status.cancel"),
      saveAndNew: translate("ui.status.saveAndNew"),
    },
    featureGuard: {
      locked: translate("ui.featureGuard.locked"),
      tierRequired: translate("ui.featureGuard.tierRequired"),
      moduleDisabled: translate("ui.featureGuard.moduleDisabled"),
      permissionMissing: translate("ui.featureGuard.permissionMissing"),
      upgradeTo: translate("ui.featureGuard.upgradeTo"),
      openModules: translate("ui.featureGuard.openModules"),
      tiers: {
        pro: translate("ui.featureGuard.tiers.pro"),
        enterprise: translate("ui.featureGuard.tiers.enterprise"),
      },
    },
  };

  return (
    <UiLocaleProvider locale={locale as UiLocale} messages={messages}>
      <LocalePreferenceSync locale={locale} />
      {children}
    </UiLocaleProvider>
  );
}

function LocalePreferenceSync({ locale }: { locale: string }) {
  const { isAuthenticated } = useConvexAuth();
  const setPreference = useMutation(api.userPreferences.set);

  useEffect(() => {
    if (!isAuthenticated) return;
    void setPreference({ key: "language", value: locale }).catch(
      () => undefined,
    );
  }, [isAuthenticated, locale, setPreference]);

  return null;
}
