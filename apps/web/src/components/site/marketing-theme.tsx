"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useState,
} from "react";

export type MarketingTheme = "dark" | "light";

const STORAGE_KEY = "museumlite-marketing-theme";

const MarketingThemeContext = createContext<{
  theme: MarketingTheme;
  setTheme: (theme: MarketingTheme) => void;
  toggleTheme: () => void;
} | null>(null);

function applyTheme(theme: MarketingTheme) {
  const root = document.documentElement;
  if (theme === "light") {
    root.classList.add("marketing-theme-light");
  } else {
    root.classList.remove("marketing-theme-light");
  }
}

export function readStoredTheme(): MarketingTheme {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* ignore */
  }
  return "dark";
}

export function MarketingThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<MarketingTheme>("dark");

  useLayoutEffect(() => {
    const stored = readStoredTheme();
    setThemeState(stored);
    applyTheme(stored);
  }, []);

  const setTheme = useCallback((next: MarketingTheme) => {
    setThemeState(next);
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next: MarketingTheme = current === "dark" ? "light" : "dark";
      applyTheme(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return (
    <MarketingThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </MarketingThemeContext.Provider>
  );
}

export function useMarketingTheme() {
  const ctx = useContext(MarketingThemeContext);
  if (!ctx) {
    throw new Error("useMarketingTheme must be used within MarketingThemeProvider");
  }
  return ctx;
}

/** Inline script to set theme class before paint (avoids flash). */
export function MarketingThemeScript() {
  const script = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");if(t==="light"){document.documentElement.classList.add("marketing-theme-light");}}catch(e){}})();`;
  return (
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: theme bootstrap only
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
