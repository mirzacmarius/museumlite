"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { getAppLoginUrl } from "@/lib/app-login-url";
import { NavLink } from "./nav-link";
import { ThemeSwitcher } from "./theme-switcher";

const links = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const panelId = useId();
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const signInUrl = getAppLoginUrl();

  const close = useCallback(() => setOpen(false), []);

  const handleEscape = useEffectEvent(() => {
    close();
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  const menuPanel =
    open && isMounted
      ? createPortal(
          <nav
            id={panelId}
            aria-label="Mobile"
            className="fixed inset-0 z-[200] flex min-h-dvh w-full flex-col bg-background px-6 py-6 shadow-gallery"
          >
            <div className="flex items-center justify-between mb-10">
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Menu
              </span>
              <div className="flex items-center gap-3">
                <ThemeSwitcher />
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-gold"
                  onClick={close}
                >
                  Close
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
                Sign in
              </a>
            </div>
          </nav>,
          document.body,
        )
      : null;

  return (
    <div className="lg:hidden flex items-center gap-2">
      <ThemeSwitcher className="sm:hidden" />
      <button
        type="button"
        className="inline-flex size-10 items-center justify-center rounded-full text-ivory hover:bg-muted/50 transition-colors"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="sr-only">{open ? "Close" : "Menu"}</span>
        <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden>
          <path
            d={open ? "M2 2l14 10M16 2L2 12" : "M0 1h18M0 7h18M0 13h18"}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {menuPanel}
    </div>
  );
}
