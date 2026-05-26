"use client";

import { useMarketingTheme } from "./marketing-theme";

export function ThemeSwitcher({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useMarketingTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:text-gold hover:bg-muted/60 transition-colors ${className}`}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
    >
      {theme === "dark" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M21 14.5A7.5 7.5 0 0111.5 5 7.5 7.5 0 0014.5 21 9.5 9.5 0 0021 14.5z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
