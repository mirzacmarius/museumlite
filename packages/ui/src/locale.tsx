"use client";

import type { Locale as DateFnsLocale } from "date-fns";
import { enUS, es, fr, nb, ro } from "date-fns/locale";
import { createContext, type ReactNode, useContext } from "react";

export type UiLocale = "en" | "fr" | "es" | "no" | "ro";

export interface UiMessages {
  dialog: { close: string };
  sheet: { close: string };
  sidebar: {
    title: string;
    description: string;
    toggle: string;
    progress: string;
  };
  command: { title: string; description: string };
  filters: {
    title: string;
    search: string;
    clearAll: string;
    clearSearch: string;
    removeFilter: string;
  };
  pagination: {
    loadMore: string;
    previous: string;
    next: string;
    page: string;
    of: string;
    rowsPerPage: string;
  };
  wizard: { progress: string; previous: string; next: string; finish: string };
  calendar: {
    selectDate: string;
    month: string;
    year: string;
    today: string;
    selected: string;
    previousMonth: string;
    nextMonth: string;
    previousYear: string;
    nextYear: string;
  };
  datePicker: {
    placeholder: string;
    clear: string;
    today: string;
    naturalLanguageHint: string;
    invalidDate: string;
  };
  lightbox: {
    image: string;
    zoomIn: string;
    zoomOut: string;
    download: string;
    close: string;
    previousImage: string;
    nextImage: string;
    thumbnail: string;
  };
  gallery: { closeImageView: string; viewImage: string; moreImages: string };
  chart: { loading: string };
  tagList: { more: string };
  timeline: { today: string };
  sonner: { notifications: string; close: string };
  card: { title: string };
  status: {
    saving: string;
    saved: string;
    unsaved: string;
    error: string;
    save: string;
    cancel: string;
    saveAndNew: string;
  };
  featureGuard: {
    unavailable: string;
    locked: string;
    upgradeTo: string;
    tiers: { pro: string; enterprise: string };
  };
}

export const defaultUiMessages: UiMessages = {
  dialog: { close: "Close" },
  sheet: { close: "Close" },
  sidebar: {
    title: "Sidebar",
    description: "Displays the mobile sidebar.",
    toggle: "Toggle Sidebar",
    progress: "Progress",
  },
  command: {
    title: "Command Palette",
    description: "Search and run actions from the command palette.",
  },
  filters: {
    title: "Filters",
    search: "Search",
    clearAll: "Clear all",
    clearSearch: "Clear search",
    removeFilter: "Remove {label} filter",
  },
  pagination: {
    loadMore: "Load more",
    previous: "Previous",
    next: "Next",
    page: "Page",
    of: "of",
    rowsPerPage: "Rows per page",
  },
  wizard: {
    progress: "Progress",
    previous: "Back",
    next: "Continue",
    finish: "Complete",
  },
  calendar: {
    selectDate: "Select date",
    month: "Choose month",
    year: "Choose year",
    today: "Today",
    selected: "Selected",
    previousMonth: "Go to previous month",
    nextMonth: "Go to next month",
    previousYear: "Go to previous year",
    nextYear: "Go to next year",
  },
  datePicker: {
    placeholder: "Pick a date",
    clear: "Clear date",
    today: "Today",
    naturalLanguageHint: "Try typing a date, like tomorrow or 2026-06-14",
    invalidDate: "Enter a valid date",
  },
  lightbox: {
    image: "Image",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    download: "Download image",
    close: "Close",
    previousImage: "Previous image",
    nextImage: "Next image",
    thumbnail: "Thumbnail {index}",
  },
  gallery: {
    closeImageView: "Close image view",
    viewImage: "View {title}",
    moreImages: "{count} more images",
  },
  chart: { loading: "Loading chart…" },
  tagList: { more: "more" },
  timeline: { today: "Today" },
  sonner: { notifications: "Notifications", close: "Close notification" },
  card: { title: "Card title" },
  status: {
    saving: "Saving…",
    saved: "Saved",
    unsaved: "Unsaved changes",
    error: "Save failed",
    save: "Save",
    cancel: "Cancel",
    saveAndNew: "Save & Add Another",
  },
  featureGuard: {
    unavailable: "This feature is not available on your plan.",
    locked: "{featureName} is locked",
    upgradeTo: "Upgrade to {tier}",
    tiers: { pro: "Pro", enterprise: "Enterprise" },
  },
};

const localeDateFns: Record<UiLocale, DateFnsLocale> = {
  en: enUS,
  fr,
  es,
  no: nb,
  ro,
};

interface UiLocaleContextValue {
  locale: UiLocale;
  messages: UiMessages;
  dateFnsLocale: DateFnsLocale;
}

const UiLocaleContext = createContext<UiLocaleContextValue>({
  locale: "en",
  messages: defaultUiMessages,
  dateFnsLocale: localeDateFns.en,
});

export function UiLocaleProvider({
  children,
  locale = "en",
  messages = defaultUiMessages,
}: {
  children: ReactNode;
  locale?: UiLocale;
  messages?: UiMessages;
}) {
  return (
    <UiLocaleContext.Provider
      value={{ locale, messages, dateFnsLocale: localeDateFns[locale] }}
    >
      {children}
    </UiLocaleContext.Provider>
  );
}

export function useUiLocale(): UiLocaleContextValue {
  return useContext(UiLocaleContext);
}

export function formatUiMessage(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
