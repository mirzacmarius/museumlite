"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
} from "react";
import { getAppLoginUrl } from "@/lib/app-login-url";
import { useWebI18n } from "@/locales/provider";
import { LocaleSwitcher } from "./locale-switcher";
import { NavLink } from "./nav-link";
import { ThemeSwitcher } from "./theme-switcher";

export function MobileNav() {
  const { locale, t } = useWebI18n();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const signInUrl = getAppLoginUrl(locale);
  const links = [
    { href: "/features", label: t("common.nav.features") },
    { href: "/pricing", label: t("common.nav.pricing") },
    { href: "/about", label: t("common.nav.about") },
    { href: "/contact", label: t("common.nav.contact") },
  ];

  const close = useCallback(() => setOpen(false), []);

  const handleEscape = useEffectEvent(() => {
    close();
  });

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleEscape();
    };

    document.body.style.overflow = "hidden";
    firstLinkRef.current?.focus();
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="lg:hidden flex items-center gap-2">
      <ThemeSwitcher className="sm:hidden" />
      <button
        type="button"
        className="inline-flex size-10 items-center justify-center rounded-full text-ivory hover:bg-muted/50 transition-colors"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? t("common.nav.closeMenu") : t("common.nav.openMenu")}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="sr-only">
          {open ? t("common.nav.closeMenu") : t("common.nav.menu")}
        </span>
        <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden>
          <path
            d={open ? "M2 2l14 10M16 2L2 12" : "M0 1h18M0 7h18M0 13h18"}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <button
          type="button"
          aria-label={t("common.nav.closeMenu")}
          className="fixed inset-0 z-50 border-0 bg-ink/80 p-0 backdrop-blur-sm"
          onClick={close}
        />
      )}

      <nav
        id={panelId}
        aria-label={t("common.nav.mobile")}
        hidden={!open}
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-border bg-background p-6 shadow-gallery transition-transform ${
          open ? "translate-x-0" : "translate-x-full pointer-events-none"
        }`}
      >
        <div className="flex items-center justify-between mb-10">
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {t("common.nav.menu")}
          </span>
          <div className="flex items-center gap-3">
            <LocaleSwitcher />
            <ThemeSwitcher />
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-gold"
              onClick={close}
            >
              {t("common.nav.closeMenu")}
            </button>
          </div>
        </div>

        <ul className="flex flex-col gap-6 text-xs uppercase tracking-[0.15em]">
          {links.map((link, i) => (
            <li key={link.href}>
              <NavLink
                ref={i === 0 ? firstLinkRef : undefined}
                href={link.href}
                label={link.label}
                onClick={close}
              />
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-10">
          <a
            href={signInUrl}
            className="block text-center text-sm text-muted-foreground hover:text-gold"
          >
            {t("common.nav.signIn")}
          </a>
        </div>
      </nav>
    </div>
  );
}
